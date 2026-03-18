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
  // Additional control variants
  'R2.1_(Equestrians)', 'R2.1_(Pedestrians_and_Equestrians)',
  // Additional de-restriction
  'R202-600', 'R203-600', 'R205-600', 'R245-600',
  // Additional reservation
  'R341-1', 'R341-2', 'R341-3',
  // Additional selective
  'R530', 'R530-B', 'R531', 'R531-B',
  // Additional warning
  'W346',
  // Additional information — direction plates
  'IN1_(Class_A1)', 'IN1_(Class_A2)', 'IN1_(Tourism)',
  'IN2_(Class_A1)', 'IN2_(Class_A2)', 'IN2_(Tourism)',
  'IN3_(Class_A1)', 'IN3_(Class_A2)', 'IN3_(Tourism)',
  // Supplementary plates (IN11.x)
  'IN11.1', 'IN11.2', 'IN11.3', 'IN11.4', 'IN11.4_(Blind_People)',
  'IN11.501', 'IN11.502', 'IN11.503', 'IN11.504', 'IN11.505', 'IN11.506',
  'IN11.560', 'IN11.561', 'IN11.562', 'IN11.563', 'IN11.564', 'IN11.565',
  'IN11.566', 'IN11.567', 'IN11.568', 'IN11.569', 'IN11.570', 'IN11.571',
  'IN11.572', 'IN11.573', 'IN11.574', 'IN11.575', 'IN11.576', 'IN11.577',
  'IN11.578', 'IN11.579', 'IN11.580', 'IN11.581', 'IN11.582', 'IN11.583',
  'IN19',
  // Temporary warning signs (TW)
  'TW101', 'TW102', 'TW103', 'TW104', 'TW105', 'TW106', 'TW107', 'TW108',
  'TW109', 'TW110', 'TW111', 'TW112', 'TW113', 'TW114', 'TW115', 'TW116',
  'TW117', 'TW118', 'TW119',
  'TW201', 'TW202', 'TW203', 'TW204', 'TW205', 'TW206', 'TW207', 'TW208',
  'TW209', 'TW210', 'TW211', 'TW212', 'TW213', 'TW214', 'TW215', 'TW216',
  'TW217', 'TW218',
  'TW301', 'TW302', 'TW303', 'TW304', 'TW305', 'TW306', 'TW307', 'TW308',
  'TW309', 'TW310', 'TW311', 'TW312', 'TW313', 'TW314', 'TW315', 'TW316',
  'TW317', 'TW318', 'TW320', 'TW321', 'TW322', 'TW323', 'TW324', 'TW325',
  'TW326', 'TW327', 'TW328', 'TW329', 'TW330', 'TW331', 'TW332', 'TW333',
  'TW334', 'TW335', 'TW336', 'TW337', 'TW338', 'TW339', 'TW340', 'TW341',
  'TW342', 'TW343', 'TW344', 'TW345', 'TW346', 'TW347', 'TW348', 'TW349',
  'TW350', 'TW352', 'TW353', 'TW354', 'TW355', 'TW356', 'TW357', 'TW358',
  'TW359', 'TW360', 'TW361', 'TW363',
  'TW401', 'TW402', 'TW405', 'TW406', 'TW407', 'TW408', 'TW409', 'TW410',
  'TW411', 'TW412', 'TW413', 'TW414', 'TW415',
  // Temporary regulatory signs (TR — command)
  'TR101', 'TR101-600', 'TR102', 'TR103', 'TR104', 'TR105', 'TR106', 'TR107',
  'TR108', 'TR109', 'TR110', 'TR111', 'TR112', 'TR113', 'TR114', 'TR115',
  'TR116', 'TR117', 'TR118', 'TR119', 'TR120', 'TR121', 'TR122', 'TR123',
  'TR124', 'TR125', 'TR126', 'TR127', 'TR128', 'TR129', 'TR130', 'TR131',
  'TR133', 'TR133-600', 'TR134', 'TR135', 'TR136', 'TR137', 'TR138', 'TR139', 'TR140',
  // TR — prohibition
  'TR201-5', 'TR201-10', 'TR201-20', 'TR201-30', 'TR201-40', 'TR201-50',
  'TR201-60', 'TR201-70', 'TR201-75', 'TR201-80', 'TR201-90',
  'TR201-100', 'TR201-120', 'TR201-120-TR511', 'TR201-100-TR512',
  'TR202', 'TR202-600', 'TR203', 'TR203-600', 'TR204', 'TR205', 'TR205-600',
  'TR208', 'TR209', 'TR210', 'TR211', 'TR212', 'TR213', 'TR214', 'TR215',
  'TR216', 'TR217', 'TR218', 'TR219', 'TR220', 'TR222', 'TR223', 'TR224',
  'TR225', 'TR226', 'TR227', 'TR228', 'TR229', 'TR230', 'TR231', 'TR232',
  'TR233', 'TR234', 'TR235', 'TR236', 'TR237', 'TR238', 'TR239', 'TR240',
  'TR241', 'TR242', 'TR245', 'TR245-600',
  // TR — reservation/parking
  'TR301', 'TR301-P', 'TR302', 'TR303', 'TR304', 'TR304-P', 'TR305-P',
  'TR306-P', 'TR307', 'TR307-P', 'TR308', 'TR308-P', 'TR309', 'TR309-P',
  'TR310', 'TR310-P', 'TR311', 'TR311-P', 'TR312', 'TR312-P', 'TR313',
  'TR313-P', 'TR314', 'TR314-P', 'TR315', 'TR315-P', 'TR316', 'TR316-P',
  'TR317', 'TR317-P', 'TR318', 'TR318-P', 'TR319', 'TR319-P', 'TR320',
  'TR320-P', 'TR321', 'TR321-P', 'TR322', 'TR322-P', 'TR323', 'TR323-P',
  'TR324', 'TR324-P', 'TR327', 'TR327-P', 'TR328', 'TR329', 'TR330',
  'TR330-P', 'TR331', 'TR332', 'TR333', 'TR333-P', 'TR334', 'TR335',
  'TR336', 'TR337', 'TR338', 'TR339', 'TR340', 'TR342', 'TR343', 'TR344',
  'TR345', 'TR346', 'TR347', 'TR348', 'TR349', 'TR350', 'TR351', 'TR352',
  'TR353', 'TR354',
  // TR — comprehensive/de-restriction
  'TR401-600', 'TR402', 'TR402-600',
  // TR — selective
  'TR501', 'TR501-B', 'TR502', 'TR502-B', 'TR503', 'TR503-B', 'TR504',
  'TR504-B', 'TR505', 'TR506', 'TR511', 'TR511-B', 'TR512', 'TR512-B',
  'TR520', 'TR520-B', 'TR521', 'TR521-B', 'TR522', 'TR522-B', 'TR523',
  'TR530', 'TR530-B', 'TR531', 'TR531-B', 'TR532', 'TR532-B', 'TR533',
  'TR533-B', 'TR534', 'TR535', 'TR535-B', 'TR540',
  'TR560', 'TR560-B', 'TR561', 'TR561-B', 'TR562', 'TR562-B', 'TR563',
  'TR563-B', 'TR564', 'TR564-B', 'TR565', 'TR565-B', 'TR566', 'TR566-B',
  'TR567', 'TR567-B', 'TR568', 'TR568-B', 'TR569', 'TR569-B', 'TR570',
  'TR570-B', 'TR571', 'TR571-B', 'TR572', 'TR572-B', 'TR573', 'TR573-B',
  'TR574', 'TR574-B', 'TR575', 'TR575-B', 'TR576', 'TR576-B', 'TR577',
  'TR577-B', 'TR578', 'TR578-B', 'TR579', 'TR579-B', 'TR580', 'TR580-B',
  'TR581', 'TR581-B', 'TR582', 'TR582-B', 'TR583', 'TR583-B',
  // Temporary information signs (TIN)
  'TIN1', 'TIN2', 'TIN3', 'TIN4', 'TIN5', 'TIN6',
  'TIN11.1', 'TIN11.2', 'TIN11.3', 'TIN11.4', 'TIN11.4_(Accident)',
  'TIN11.501', 'TIN11.502', 'TIN11.503', 'TIN11.504', 'TIN11.505',
  'TIN11.560', 'TIN11.561', 'TIN11.562', 'TIN11.563', 'TIN11.564',
  'TIN11.565', 'TIN11.566', 'TIN11.567', 'TIN11.568', 'TIN11.569',
  'TIN11.570', 'TIN11.571', 'TIN11.572', 'TIN11.573', 'TIN11.574',
  'TIN11.575', 'TIN11.576', 'TIN11.577', 'TIN11.578', 'TIN11.579',
  'TIN11.580', 'TIN11.581', 'TIN11.582', 'TIN11.583',
  'TIN13', 'TIN20', 'TIN21', 'TIN22', 'TIN23',
  // Temporary guidance direction signs (TGD)
  'TGD2-D-1', 'TGD2-D-2', 'TGD2-D-3', 'TGD3-D',
  // Guidance emergency signs (GE19)
  'GE19-05', 'GE19-06', 'GE19-07', 'GE19-10', 'GE19-12',
  'GE19-15', 'GE19-16', 'GE19-17', 'GE19-19', 'GE19-20',
  'GE19-21', 'GE19-22', 'GE19-24', 'GE19-25', 'GE19-26',
  'GE19-27', 'GE19-28', 'GE19-29', 'GE19-30', 'GE19-31',
  'GE19-32', 'GE19-34', 'GE19-35', 'GE19-36', 'GE19-40', 'GE19-50',
  'GE19-101', 'GE19-102', 'GE19-103', 'GE19-104', 'GE19-105', 'GE19-106', 'GE19-107',
  'GE19-121', 'GE19-122', 'GE19-131',
  'GE19-301', 'GE19-303',
  'GE19-421', 'GE19-422', 'GE19-423',
  // Guidance freeway direction signs (GF)
  'GF11', 'GF12', 'GF13', 'GF14', 'GF16',
  // Guidance direction signs (GDS)
  'GDS-1', 'GDS-2', 'GDS-3', 'GDS-4', 'GDS-5', 'GDS-6', 'GDS-7', 'GDS-8', 'GDS-9',
  'GDS-10', 'GDS-11', 'GDS-12', 'GDS-13', 'GDS-14', 'GDS-15', 'GDS-16', 'GDS-17', 'GDS-18',
  'GDS-20', 'GDS-21', 'GDS-22', 'GDS-23',
  // Guidance location signs (GLS)
  'GLS-1', 'GLS-2', 'GLS-3', 'GLS-4', 'GLS-5', 'GLS-6', 'GLS-7',
  // Guidance diagrammatic location signs (GDLS)
  'GDLS_A1-1', 'GDLS_A1-5', 'GDLS_A1-6', 'GDLS_A1-7', 'GDLS_A1-8', 'GDLS_A1-9',
  'GDLS_A1-10', 'GDLS_A1-11', 'GDLS_A1-12', 'GDLS_A1-14',
  'GDLS_A2-1', 'GDLS_A2-2', 'GDLS_A2-4', 'GDLS_A2-5', 'GDLS_A2-6',
  'GDLS_A2-7', 'GDLS_A2-9', 'GDLS_A2-11', 'GDLS_A2-12', 'GDLS_A2-13',
  'GDLS_A2-14', 'GDLS_A2-15',
  'GDLS_A4-3', 'GDLS_A4-5',
  // Guidance freeway signs (GFS)
  'GFS_A1', 'GFS_A1-1', 'GFS_A1-2',
  'GFS_A2',
  'GFS_A3', 'GFS_A3-1', 'GFS_A3-2', 'GFS_A3-3', 'GFS_A3-4', 'GFS_A3-5',
  'GFS_A4', 'GFS_A4-1', 'GFS_A4-3', 'GFS_A4-4', 'GFS_A4-5', 'GFS_A4-6',
  'GFS_A4-7', 'GFS_A4-8', 'GFS_A4-9', 'GFS_A4-10', 'GFS_A4-11',
  'GFS_A5-1', 'GFS_A5-2', 'GFS_A5-3', 'GFS_A5-4', 'GFS_A5-5', 'GFS_A5-6', 'GFS_A5-7', 'GFS_A5-8',
  'GFS_A6', 'GFS_A6-1', 'GFS_A6-2', 'GFS_A6-3', 'GFS_A6-4', 'GFS_A6-5',
  'GFS_A6-6', 'GFS_A6-7', 'GFS_A6-8',
  'GFS_A7', 'GFS_A7-2', 'GFS_A7-3', 'GFS_A7-4', 'GFS_A7-5', 'GFS_A7-6', 'GFS_A7-7',
  'GFS_A8', 'GFS_A8-1', 'GFS_A8-2', 'GFS_A8-3', 'GFS_A8-4', 'GFS_A8-5',
  'GFS_A8-6', 'GFS_A8-7', 'GFS_A8-8', 'GFS_A8-9', 'GFS_A8-10', 'GFS_A8-11', 'GFS_A8-12',
  'GFS_A9', 'GFS_A9-1', 'GFS_A9-2', 'GFS_A9-3', 'GFS_A9-4', 'GFS_A9-5',
  'GFS_A9-6', 'GFS_A9-7', 'GFS_A9-8',
  'GFS_A10', 'GFS_A10-1', 'GFS_A10-2',
  'GFS_A11-1', 'GFS_A11-2', 'GFS_A11-3', 'GFS_A11-4', 'GFS_A11-5', 'GFS_A11-6', 'GFS_A11-7',
  'GFS_A12', 'GFS_A12-1', 'GFS_A12-2', 'GFS_A12-3', 'GFS_A12-4', 'GFS_A12-5',
  'GFS_A12-6', 'GFS_A12-7', 'GFS_A12-8', 'GFS_A12-9',
  'GFS_A13-1',
  'GFS_B1-1', 'GFS_B1-2', 'GFS_B1-3', 'GFS_B1-4', 'GFS_B1-5',
  'GFS_B1-6', 'GFS_B1-7', 'GFS_B1-8', 'GFS_B1-9', 'GFS_B1-10',
  'GFS_B2-1', 'GFS_B2-2', 'GFS_B2-3', 'GFS_B2-4',
  'GFS_B3-1',
  'GFS_B4-1', 'GFS_B4-2', 'GFS_B4-3', 'GFS_B4-4',
  'GFS_B5-1', 'GFS_B5-2', 'GFS_B5-3', 'GFS_B5-4', 'GFS_B5-5',
  'GFS_B5-6', 'GFS_B5-7', 'GFS_B5-8', 'GFS_B5-9', 'GFS_B5-10', 'GFS_B5-11',
  'GFS_B6-1', 'GFS_B6-2', 'GFS_B6-3',
  'GFS_B7-1', 'GFS_B7-2', 'GFS_B7-3', 'GFS_B7-4', 'GFS_B7-5', 'GFS_B7-6',
  'GFS_C1-1', 'GFS_C1-2', 'GFS_C1-3', 'GFS_C1-4', 'GFS_C1-5',
  'GFS_C1-6', 'GFS_C1-7', 'GFS_C1-8', 'GFS_C1-9', 'GFS_C1-10', 'GFS_C1-11',
  'GFS_D1-1', 'GFS_D1-2', 'GFS_D1-3', 'GFS_D1-4', 'GFS_D1-5',
  'GFS_D1-6', 'GFS_D1-7', 'GFS_D1-8', 'GFS_D1-9', 'GFS_D1-10',
  'GFS_D1-11', 'GFS_D1-12', 'GFS_D1-13',
  'GFS_D1-14-1', 'GFS_D1-14-2', 'GFS_D1-15-1', 'GFS_D1-15-2',
  'GFS_D1-16-1', 'GFS_D1-16-2',
  'GFS_D1-17', 'GFS_D1-18', 'GFS_D1-19', 'GFS_D1-20',
  'GFS_D1-21', 'GFS_D1-22', 'GFS_D1-23', 'GFS_D1-24',
  'GFS_D1-25', 'GFS_D1-26', 'GFS_D1-27', 'GFS_D1-28',
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
        // Restore underscores (API converts _ to space in titles)
        result.set(match[1].replace(/ /g, '_'), page.imageinfo[0].url);
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
