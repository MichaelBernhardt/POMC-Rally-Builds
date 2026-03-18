/**
 * Download SADC road sign SVGs from Wikimedia Commons.
 * Usage: node scripts/download-signs.mjs
 *
 * - Uses Wikimedia API with batch queries (up to 50 titles per call)
 * - Proper User-Agent header per Wikimedia policy
 * - Retry with exponential backoff on 429/5xx
 * - Skips already-downloaded files
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'signs');

const USER_AGENT = 'POMCRallyPlanner/1.0 (https://github.com/pomc; road-sign-reference) node-fetch';

const SIGNS = [
  // Control
  'R1', 'R1.1', 'R1.2', 'R1.3', 'R1.4', 'R1.5',
  'R2', 'R2.1', 'R2.2', 'R3',
  'R4.1', 'R4.2', 'R4.3', 'R5', 'R6',
  // Command
  'R101', 'R102', 'R103', 'R104', 'R105', 'R106', 'R107', 'R108', 'R109',
  'R110', 'R111', 'R112', 'R113', 'R114', 'R115', 'R116', 'R117', 'R118', 'R119',
  'R120', 'R121', 'R122', 'R123', 'R124', 'R125', 'R126', 'R127', 'R128', 'R129',
  'R130', 'R131', 'R132', 'R133', 'R134', 'R135', 'R136', 'R137', 'R138', 'R139', 'R140',
  // Prohibition
  'R201-5', 'R201-10', 'R201-20', 'R201-30', 'R201-40', 'R201-50', 'R201-60',
  'R201-70', 'R201-75', 'R201-80', 'R201-90', 'R201-100', 'R201-120',
  'R202', 'R203', 'R204', 'R205', 'R206', 'R207', 'R208',
  'R209', 'R210', 'R211', 'R212', 'R213', 'R214', 'R215', 'R216', 'R217',
  'R218', 'R219', 'R220', 'R222', 'R223', 'R224', 'R225', 'R226', 'R227',
  'R228', 'R229', 'R230', 'R231', 'R232', 'R233', 'R234', 'R235', 'R236',
  'R237', 'R238', 'R239', 'R240', 'R241', 'R242', 'R245',
  // Reservation
  'R301', 'R302', 'R303', 'R304', 'R307', 'R308', 'R309', 'R310', 'R311',
  'R312', 'R313', 'R314', 'R315', 'R316', 'R317', 'R318', 'R319', 'R320',
  'R321', 'R322', 'R323', 'R324', 'R327', 'R328', 'R329', 'R330', 'R331',
  'R332', 'R333', 'R334', 'R335', 'R336', 'R337', 'R338', 'R339', 'R340',
  'R342', 'R343', 'R344', 'R345', 'R346', 'R347', 'R348', 'R349', 'R350',
  'R351', 'R352', 'R353', 'R354',
  // Parking
  'R301-P', 'R304-P', 'R305-P', 'R306-P', 'R307-P', 'R308-P', 'R309-P',
  'R310-P', 'R311-P', 'R312-P', 'R313-P', 'R314-P', 'R315-P', 'R316-P',
  'R317-P', 'R318-P', 'R319-P', 'R320-P', 'R321-P', 'R322-P', 'R323-P',
  'R324-P', 'R327-P', 'R330-P', 'R333-P',
  // Comprehensive
  'R401', 'R402', 'R403',
  // Selective
  'R501', 'R502', 'R503', 'R504', 'R505', 'R506', 'R511', 'R512',
  'R520', 'R521', 'R522', 'R523', 'R532', 'R533', 'R534', 'R535', 'R540',
  'R560', 'R561', 'R562', 'R563', 'R564', 'R565', 'R566', 'R567', 'R568',
  'R569', 'R570', 'R571', 'R572', 'R573', 'R574', 'R575', 'R576', 'R577',
  'R578', 'R579', 'R580', 'R581', 'R582', 'R583',
  // B-variants
  'R501-B', 'R502-B', 'R503-B', 'R504-B', 'R511-B', 'R512-B',
  'R520-B', 'R521-B', 'R522-B', 'R532-B', 'R533-B', 'R535-B',
  'R560-B', 'R561-B', 'R562-B', 'R563-B', 'R564-B', 'R565-B', 'R566-B',
  'R567-B', 'R568-B', 'R569-B', 'R570-B', 'R571-B', 'R572-B', 'R573-B',
  'R574-B', 'R575-B', 'R576-B', 'R577-B', 'R578-B', 'R579-B', 'R580-B',
  'R581-B', 'R582-B', 'R583-B',
  // De-restriction
  'R101-600', 'R132-600', 'R133-600', 'R401-600', 'R402-600', 'R403-600',
  // Warning
  'W101', 'W102', 'W103', 'W104', 'W105', 'W106', 'W107', 'W108', 'W109', 'W110',
  'W111', 'W112', 'W113', 'W114', 'W115', 'W116', 'W117', 'W118', 'W119',
  'W201', 'W202', 'W203', 'W204', 'W205', 'W206', 'W207', 'W208', 'W209', 'W210', 'W211',
  'W212', 'W213', 'W214', 'W215', 'W216', 'W217', 'W218',
  'W301', 'W302', 'W303', 'W306', 'W307', 'W308', 'W309', 'W310', 'W311', 'W312', 'W313',
  'W314', 'W315', 'W316', 'W317', 'W318', 'W319', 'W320', 'W321', 'W322', 'W323',
  'W324', 'W325', 'W326', 'W327', 'W328', 'W329', 'W330', 'W331', 'W332', 'W333',
  'W334', 'W335', 'W339', 'W348', 'W349', 'W350', 'W351', 'W352', 'W354', 'W355',
  'W356', 'W357', 'W358', 'W359', 'W360', 'W361', 'W362', 'W363', 'W365',
  'W401', 'W402', 'W403', 'W404', 'W405', 'W406', 'W407', 'W408', 'W409', 'W410',
  'W411', 'W413', 'W414', 'W415',
  // Information
  'IN4', 'IN5', 'IN6', 'IN7', 'IN9', 'IN10', 'IN12', 'IN14', 'IN15', 'IN16',
  'IN17', 'IN18', 'IN19-RHT', 'IN20',
  'R325-1', 'R325-2', 'R325-3', 'R325-4', 'R326-1', 'R326-2', 'R326-3', 'R326-4',
  'R360', 'R360-LES',
  // Combination
  'R201-120-R511', 'R201-100-R512',
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, opts = {}, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, { ...opts, headers: { 'User-Agent': USER_AGENT, ...opts.headers } });
      if (resp.ok) return resp;
      if (resp.status === 429 || resp.status >= 500) {
        const wait = Math.min(2000 * Math.pow(2, attempt), 60000);
        console.log(`  Rate-limited (${resp.status}), waiting ${wait / 1000}s...`);
        await delay(wait);
        continue;
      }
      return resp; // non-retryable error
    } catch (err) {
      const wait = Math.min(3000 * Math.pow(2, attempt), 60000);
      console.log(`  Connection error (${err.cause?.code || err.message}), retry in ${wait / 1000}s...`);
      await delay(wait);
    }
  }
  return null;
}

/**
 * Batch-resolve direct URLs via Wikimedia API (up to 50 titles per call).
 * Returns Map<code, directUrl>.
 */
async function resolveUrlsBatch(codes) {
  const titles = codes.map(c => encodeURIComponent(`File:SADC_road_sign_${c}.svg`)).join('|');
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${titles}&prop=imageinfo&iiprop=url&format=json`;
  const resp = await fetchWithRetry(apiUrl);
  if (!resp || !resp.ok) {
    console.error('  API batch query failed');
    return new Map();
  }
  const data = await resp.json();
  const result = new Map();
  const pages = data.query?.pages ?? {};
  for (const page of Object.values(pages)) {
    if (page.imageinfo?.length > 0) {
      // Extract code from title: "File:SADC road sign R1.svg" (API normalizes _ to space)
      const match = page.title?.match(/^File:SADC road sign (.+)\.svg$/);
      if (match) {
        result.set(match[1], page.imageinfo[0].url);
      }
    }
  }
  return result;
}

async function downloadFile(url, outPath) {
  const resp = await fetchWithRetry(url);
  if (!resp || !resp.ok) return false;
  const buffer = Buffer.from(await resp.arrayBuffer());
  await writeFile(outPath, buffer);
  return true;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // Filter to only signs that haven't been downloaded yet
  const pending = SIGNS.filter(code => !existsSync(join(OUT_DIR, `${code}.svg`)));
  const skipped = SIGNS.length - pending.length;
  if (skipped > 0) console.log(`Skipping ${skipped} already downloaded signs`);
  if (pending.length === 0) { console.log('All signs already downloaded!'); return; }

  console.log(`Downloading ${pending.length} signs...\n`);

  let ok = 0;
  let fail = 0;
  const failures = [];

  // Process in batches of 50 (Wikimedia API limit)
  const BATCH_SIZE = 50;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pending.length / BATCH_SIZE)} (${batch.length} signs)`);

    // Resolve all URLs in one API call
    const urlMap = await resolveUrlsBatch(batch);
    await delay(500);

    // Download each file sequentially with delays
    for (const code of batch) {
      const outPath = join(OUT_DIR, `${code}.svg`);
      const directUrl = urlMap.get(code);

      if (!directUrl) {
        console.error(`FAIL ${code}: not found on Wikimedia`);
        fail++;
        failures.push(code);
        continue;
      }

      try {
        const success = await downloadFile(directUrl, outPath);
        if (success) {
          console.log(`OK   ${code}`);
          ok++;
        } else {
          console.error(`FAIL ${code}: download failed`);
          fail++;
          failures.push(code);
        }
      } catch (err) {
        console.error(`FAIL ${code}: ${err.message}`);
        fail++;
        failures.push(code);
      }

      await delay(500); // 500ms between individual downloads
    }

    // Extra pause between batches
    if (i + BATCH_SIZE < pending.length) {
      console.log('Pausing 5s between batches...');
      await delay(5000);
    }
  }

  console.log(`\nDone: ${ok} downloaded, ${fail} failed, ${skipped} skipped (already existed)`);
  if (failures.length > 0) {
    console.log('Failed signs:', failures.join(', '));
  }
}

main();
