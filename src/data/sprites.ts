/**
 * Pixel-art robots, one character per pixel. Rendered by PixelSprite.
 *
 *   S silkscreen white   D outline   M metal joint
 *   G ENIG gold          C copper    R red LED      L green LED
 *   . transparent
 *
 * These are illustrations in the silkscreen idiom, not engineering
 * drawings: they show what kind of robot each programme is, never its
 * real geometry. Two frames make a loop (walk cycle, gripper).
 */

// --- H1: humanoid, 16 x 26 ------------------------------------------------
const H1_TOP = [
  '......DDDD......',
  '....DDSSSSDD....',
  '...DSSSSSSSSD...',
  '...DDDDDDDDDD...',
  '...DDGGDDGGDD...',
  '...DSSSSSSSSD...',
  '....DDDDDDDD....',
  '......DMMD......',
  '..DDDDDDDDDDDD..',
  '.DSDSSSSSSSSDSD.',
  '.DSDSSSRRSSSDSD.',
  '.DMDSSSSSSSSDMD.',
  '.DSDSDDDDDDSDSD.',
  '.DSDSSSSSSSSDSD.',
  '.DSD.DSSSSD.DSD.',
  '.DGD.DMMMMD.DGD.',
  '.DDD.DSSSSD.DDD.',
];

export const H1 = [
  [
    ...H1_TOP,
    '.....DSDDSD.....',
    '.....DSDDSD.....',
    '.....DMDDMD.....',
    '.....DSDDSD.....',
    '.....DSDDSD.....',
    '.....DSDDSD.....',
    '....DDSDDSDD....',
    '....DSSDDSSD....',
    '....DDDDDDDD....',
  ],
  [
    ...H1_TOP,
    '.....DSDDSD.....',
    '.....DSDDSD.....',
    '....DMD..DMD....',
    '....DSD..DSD....',
    '...DSD....DSD...',
    '...DSD....DSD...',
    '..DDSD....DSDD..',
    '..DSSD....DSSD..',
    '..DDDD....DDDD..',
  ],
];

/** H1 standing still — for places where a walk cycle would distract. */
export const H1_STILL = [H1[0]];

// --- Q1: quadruped, 24 x 14 -----------------------------------------------
const Q1_BODY = [
  '................DDDDD...',
  '...............DSSSSSD..',
  '...............DSSSGSDD.',
  '..DDDDDDDDDDDDDDSSSSSSSD',
  '.DSSSSSSSSSSSSSSSSDDDD..',
  '.DSSSSSSSRSSSSSSSSD.....',
  '.DMMSSSSSSSSSSSSMMD.....',
  '..DDDDDDDDDDDDDDDD......',
];

export const Q1 = [
  [
    ...Q1_BODY,
    '..DMD.........DMD.......',
    '..DSD.........DSD.......',
    '...DSD.........DSD......',
    '...DMD.........DMD......',
    '..DSD.........DSD.......',
    '..DDDD........DDDD......',
  ],
  [
    ...Q1_BODY,
    '..DMD.........DMD.......',
    '..DSD.........DSD.......',
    '.DSD.........DSD........',
    '.DMD.........DMD........',
    '..DSD.........DSD.......',
    '..DDDD........DDDD......',
  ],
];

// --- Teleoperation arm with its operator's joystick, 16 x 16 ---------------
const TELEOP_MID = [
  '...........DMD..',
  '..........DSD...',
  '.........DSD....',
  '........DSD.....',
  '....DDDDMMD.....',
  '...DSSSSSMD.....',
  '...DMDDDDDD.....',
  '...DSD..........',
];

const TELEOP_BASE = [
  '..DDMDD....D....',
  '.DSSSSSD..DRD...',
  '.DSRSSSD.DSSSD..',
  'DDDDDDDDDDDDDDD.',
];

export const ARM_TELEOP = [
  [
    '...........D.D..',
    '...........G.G..',
    '..........DGGGD.',
    ...TELEOP_MID,
    '...DSD.....D....',
    ...TELEOP_BASE,
  ],
  [
    '............D...',
    '...........DGD..',
    '..........DGGGD.',
    ...TELEOP_MID,
    '...DSD......D...',
    ...TELEOP_BASE,
  ],
];

// --- Precision arm over a part on a fixture, 16 x 16 -----------------------
const PRECISION_TOP = [
  '................',
  '..DDDDDDDDDDD...',
  '..DMSSSSSSSMD...',
  '..DSDDDDDDDDD...',
  '..DSD.....DMD...',
  '..DSD......D....',
  '..DMD.....DGD...',
];

const PRECISION_BOTTOM = [
  '..DSD...........',
  '..DSD.....DGD...',
  '.DDMDD....DGD...',
  'DSSSSSD..DDDDD..',
  'DSRSSSD..DMMMD..',
  'DDDDDDDDDDDDDDDD',
  '................',
];

export const ARM_PRECISION = [
  [...PRECISION_TOP, '..DSD....DG.GD..', '..DSD....G...G..', ...PRECISION_BOTTOM],
  [...PRECISION_TOP, '..DSD.....DGD...', '..DSD.....G.G...', ...PRECISION_BOTTOM],
];
