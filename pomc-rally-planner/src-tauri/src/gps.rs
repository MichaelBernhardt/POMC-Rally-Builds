use serde::{Deserialize, Serialize};
use serialport::{SerialPort, SerialPortInfo};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::watch;

// ── Data types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GpsData {
    pub connected: bool,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub altitude: Option<f64>,
    pub speed_knots: Option<f64>,
    pub speed_kmh: Option<f64>,
    pub heading: Option<f64>,
    pub utc_time: Option<String>,
    pub utc_date: Option<String>,
    pub fix_quality: u8,
    pub fix_quality_label: String,
    pub fix_type: u8,
    pub fix_type_label: String,
    pub satellites_used: u8,
    pub hdop: Option<f64>,
    pub vdop: Option<f64>,
    pub pdop: Option<f64>,
    pub satellites: Vec<SatelliteInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SatelliteInfo {
    pub prn: u16,
    pub elevation: Option<u16>,
    pub azimuth: Option<u16>,
    pub snr: Option<u16>,
    pub constellation: String,
    pub used: bool,
}

// ── GPS state accumulator ───────────────────────────────────────────────────

#[derive(Debug, Default)]
struct GpsState {
    latitude: Option<f64>,
    longitude: Option<f64>,
    altitude: Option<f64>,
    speed_knots: Option<f64>,
    speed_kmh: Option<f64>,
    heading: Option<f64>,
    utc_time: Option<String>,
    utc_date: Option<String>,
    fix_quality: u8,
    fix_type: u8,
    satellites_used: u8,
    hdop: Option<f64>,
    vdop: Option<f64>,
    pdop: Option<f64>,
    gsv_satellites: Vec<SatelliteInfo>,
    used_prns: Vec<u16>,
}

impl GpsState {
    fn to_gps_data(&self) -> GpsData {
        let mut sats = self.gsv_satellites.clone();
        for sat in &mut sats {
            sat.used = self.used_prns.contains(&sat.prn);
        }
        GpsData {
            connected: true,
            latitude: self.latitude,
            longitude: self.longitude,
            altitude: self.altitude,
            speed_knots: self.speed_knots,
            speed_kmh: self.speed_kmh,
            heading: self.heading,
            utc_time: self.utc_time.clone(),
            utc_date: self.utc_date.clone(),
            fix_quality: self.fix_quality,
            fix_quality_label: match self.fix_quality {
                0 => "No Fix".to_string(),
                1 => "GPS".to_string(),
                2 => "DGPS".to_string(),
                4 => "RTK Fixed".to_string(),
                5 => "RTK Float".to_string(),
                _ => format!("Unknown ({})", self.fix_quality),
            },
            fix_type: self.fix_type,
            fix_type_label: match self.fix_type {
                1 => "No Fix".to_string(),
                2 => "2D Fix".to_string(),
                3 => "3D Fix".to_string(),
                _ => "Unknown".to_string(),
            },
            satellites_used: self.satellites_used,
            hdop: self.hdop,
            vdop: self.vdop,
            pdop: self.pdop,
            satellites: sats,
        }
    }
}

// ── Connection state ────────────────────────────────────────────────────────

struct GpsConnection {
    stop_tx: watch::Sender<bool>,
}

pub struct GpsManager {
    connection: Arc<Mutex<Option<GpsConnection>>>,
}

impl GpsManager {
    pub fn new() -> Self {
        GpsManager {
            connection: Arc::new(Mutex::new(None)),
        }
    }
}

// ── NMEA parsing ────────────────────────────────────────────────────────────

fn validate_checksum(sentence: &str) -> bool {
    let sentence = sentence.trim();
    if !sentence.starts_with('$') {
        return false;
    }
    if let Some(star_pos) = sentence.find('*') {
        let body = &sentence[1..star_pos];
        let checksum_str = &sentence[star_pos + 1..];
        let computed: u8 = body.bytes().fold(0u8, |acc, b| acc ^ b);
        if let Ok(expected) = u8::from_str_radix(checksum_str.trim(), 16) {
            return computed == expected;
        }
    }
    false
}

fn constellation_from_talker(talker: &str) -> &'static str {
    match talker {
        "GP" => "GPS",
        "GL" => "GLONASS",
        "GB" | "BD" => "BeiDou",
        "GA" => "Galileo",
        "GN" => "Multi",
        _ => "Unknown",
    }
}

fn parse_lat(val: &str, dir: &str) -> Option<f64> {
    if val.is_empty() {
        return None;
    }
    let dot = val.find('.')?;
    if dot < 2 {
        return None;
    }
    let degrees: f64 = val[..dot - 2].parse().ok()?;
    let minutes: f64 = val[dot - 2..].parse().ok()?;
    let mut result = degrees + minutes / 60.0;
    if dir == "S" {
        result = -result;
    }
    Some(result)
}

fn parse_lon(val: &str, dir: &str) -> Option<f64> {
    if val.is_empty() {
        return None;
    }
    let dot = val.find('.')?;
    if dot < 2 {
        return None;
    }
    let degrees: f64 = val[..dot - 2].parse().ok()?;
    let minutes: f64 = val[dot - 2..].parse().ok()?;
    let mut result = degrees + minutes / 60.0;
    if dir == "W" {
        result = -result;
    }
    Some(result)
}

fn parse_f64(s: &str) -> Option<f64> {
    if s.is_empty() {
        None
    } else {
        s.parse().ok()
    }
}

fn parse_u8(s: &str) -> u8 {
    s.parse().unwrap_or(0)
}

fn parse_u16(s: &str) -> Option<u16> {
    if s.is_empty() {
        None
    } else {
        s.parse().ok()
    }
}

fn format_utc_time(raw: &str) -> Option<String> {
    if raw.len() < 6 {
        return None;
    }
    Some(format!("{}:{}:{}", &raw[0..2], &raw[2..4], &raw[4..6]))
}

fn format_utc_date(raw: &str) -> Option<String> {
    if raw.len() < 6 {
        return None;
    }
    Some(format!("20{}-{}-{}", &raw[4..6], &raw[2..4], &raw[0..2]))
}

fn process_sentence(sentence: &str, state: &mut GpsState) -> bool {
    if !validate_checksum(sentence) {
        return false;
    }

    let star_pos = sentence.find('*').unwrap_or(sentence.len());
    let body = &sentence[1..star_pos];
    let fields: Vec<&str> = body.split(',').collect();
    if fields.is_empty() {
        return false;
    }

    let sentence_id = fields[0];
    if sentence_id.len() < 5 {
        return false;
    }
    let talker = &sentence_id[0..2];
    let sentence_type = &sentence_id[2..];

    let mut is_gga = false;

    match sentence_type {
        "GGA" if fields.len() >= 15 => {
            state.utc_time = format_utc_time(fields[1]);
            state.latitude = parse_lat(fields[2], fields[3]);
            state.longitude = parse_lon(fields[4], fields[5]);
            state.fix_quality = parse_u8(fields[6]);
            state.satellites_used = parse_u8(fields[7]);
            state.hdop = parse_f64(fields[8]);
            state.altitude = parse_f64(fields[9]);
            is_gga = true;
        }
        "RMC" if fields.len() >= 12 => {
            state.utc_time = format_utc_time(fields[1]);
            state.latitude = parse_lat(fields[3], fields[4]);
            state.longitude = parse_lon(fields[5], fields[6]);
            state.speed_knots = parse_f64(fields[7]);
            if let Some(knots) = state.speed_knots {
                state.speed_kmh = Some(knots * 1.852);
            }
            state.heading = parse_f64(fields[8]);
            state.utc_date = format_utc_date(fields[9]);
        }
        "GSA" if fields.len() >= 18 => {
            state.fix_type = parse_u8(fields[2]);
            let mut prns = Vec::new();
            for i in 3..=14 {
                if i < fields.len() {
                    if let Some(prn) = parse_u16(fields[i]) {
                        prns.push(prn);
                    }
                }
            }
            state.used_prns = prns;
            if fields.len() > 15 {
                state.pdop = parse_f64(fields[15]);
            }
            if fields.len() > 16 {
                state.hdop = parse_f64(fields[16]);
            }
            if fields.len() > 17 {
                state.vdop = parse_f64(fields[17]);
            }
        }
        "GSV" if fields.len() >= 4 => {
            let msg_num = parse_u8(fields[2]);
            let constellation = constellation_from_talker(talker);

            // First message of a GSV sequence clears old data for this constellation
            if msg_num == 1 {
                state
                    .gsv_satellites
                    .retain(|s| s.constellation != constellation);
            }

            let mut i = 4;
            while i + 3 < fields.len() {
                if let Some(prn) = parse_u16(fields[i]) {
                    state.gsv_satellites.push(SatelliteInfo {
                        prn,
                        elevation: parse_u16(fields[i + 1]),
                        azimuth: parse_u16(fields[i + 2]),
                        snr: parse_u16(fields[i + 3]),
                        constellation: constellation.to_string(),
                        used: false,
                    });
                }
                i += 4;
            }
        }
        "VTG" if fields.len() >= 8 => {
            state.heading = parse_f64(fields[1]);
            state.speed_kmh = parse_f64(fields[7]);
            if let Some(kmh) = state.speed_kmh {
                state.speed_knots = Some(kmh / 1.852);
            }
        }
        _ => {}
    }

    is_gga
}

// ── Tauri commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_serial_ports() -> Vec<PortInfo> {
    match serialport::available_ports() {
        Ok(ports) => ports
            .into_iter()
            .map(|p: SerialPortInfo| {
                let description = match &p.port_type {
                    serialport::SerialPortType::UsbPort(info) => {
                        let product = info.product.clone().unwrap_or_default();
                        let manufacturer = info.manufacturer.clone().unwrap_or_default();
                        if !product.is_empty() && !manufacturer.is_empty() {
                            format!("{} ({})", product, manufacturer)
                        } else if !product.is_empty() {
                            product
                        } else if !manufacturer.is_empty() {
                            manufacturer
                        } else {
                            "USB Serial".to_string()
                        }
                    }
                    serialport::SerialPortType::BluetoothPort => "Bluetooth".to_string(),
                    serialport::SerialPortType::PciPort => "PCI".to_string(),
                    serialport::SerialPortType::Unknown => String::new(),
                };
                PortInfo {
                    name: p.port_name,
                    description,
                }
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}

#[tauri::command]
pub async fn connect_gps(
    port_name: String,
    baud_rate: u32,
    app: AppHandle,
    manager: State<'_, GpsManager>,
) -> Result<(), String> {
    // Disconnect existing connection first
    {
        let mut conn = manager.connection.lock().map_err(|e| e.to_string())?;
        if let Some(existing) = conn.take() {
            let _ = existing.stop_tx.send(true);
        }
    }

    let port = serialport::new(&port_name, baud_rate)
        .timeout(Duration::from_millis(1000))
        .open()
        .map_err(|e| format!("Failed to open {}: {}", port_name, e))?;

    let (stop_tx, stop_rx) = watch::channel(false);

    {
        let mut conn = manager.connection.lock().map_err(|e| e.to_string())?;
        *conn = Some(GpsConnection {
            stop_tx,
        });
    }

    // Spawn blocking reader thread
    let app_handle = app.clone();
    tokio::task::spawn_blocking(move || {
        read_serial_loop(port, stop_rx, app_handle);
    });

    Ok(())
}

fn read_serial_loop(
    mut port: Box<dyn SerialPort>,
    stop_rx: watch::Receiver<bool>,
    app: AppHandle,
) {
    let mut buf = [0u8; 1024];
    let mut line_buf = String::new();
    let mut state = GpsState::default();

    loop {
        if *stop_rx.borrow() {
            break;
        }

        match port.read(&mut buf) {
            Ok(n) => {
                let chunk = String::from_utf8_lossy(&buf[..n]);
                line_buf.push_str(&chunk);

                while let Some(newline_pos) = line_buf.find('\n') {
                    let line = line_buf[..newline_pos].trim().to_string();
                    line_buf = line_buf[newline_pos + 1..].to_string();

                    if line.starts_with('$') {
                        // Emit raw NMEA
                        let _ = app.emit("gps:nmea", &line);

                        // Parse and emit structured data on GGA
                        let is_gga = process_sentence(&line, &mut state);
                        if is_gga {
                            let data = state.to_gps_data();
                            let _ = app.emit("gps:update", &data);
                        }
                    }
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                // Normal timeout, just loop
                continue;
            }
            Err(e) => {
                let _ = app.emit("gps:error", format!("Serial error: {}", e));
                break;
            }
        }
    }

    // Emit disconnected state
    let disconnected = GpsData::default();
    let _ = app.emit("gps:update", &disconnected);
}

#[tauri::command]
pub async fn disconnect_gps(manager: State<'_, GpsManager>) -> Result<(), String> {
    let mut conn = manager.connection.lock().map_err(|e| e.to_string())?;
    if let Some(existing) = conn.take() {
        let _ = existing.stop_tx.send(true);
    }
    Ok(())
}

#[tauri::command]
pub fn get_gps_status(manager: State<'_, GpsManager>) -> bool {
    let conn = manager.connection.lock().unwrap();
    conn.is_some()
}
