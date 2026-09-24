// Published figures the proportions are built from (millimetres).
//
// M4 / M4A1 carbine (US Army, Colt): overall length 838 mm (33 in) stock
// extended, 756 mm (29.75 in) collapsed; barrel 368 mm (14.5 in) measured from
// the bolt face; 1:7 in twist; carbine-length gas system.
// Mil-spec carbine receiver extension: 7.25 in long, 1.148 in outside diameter.
// STANAG 30-round magazine: ~190 mm long, 65 mm front-to-back body, 21-22 mm thick.
// MIL-STD-1913 rail: 0.835 in across the dovetail, 0.206 in slots on 0.394 in centres.
// Sight line ~2.6 in over the bore, so a flat-top rail sits ~1.2 in above it.
//
// Origin: bore axis at the upper receiver's front face (the barrel shoulder).
export const IN = 25.4;

export const D = {
  oal: 838,
  oalCollapsed: 756,
  barrel: 368,
  boltFace: -19, // bolt face / breech, just inside the upper
  upperLen: 178, // A4 flat-top upper, ~7.0 in
  railTop: 30, // top of the Picatinny flats above the bore
  railBase: 23.6,
  parting: -15, // joint between upper and lower
  upperHW: 14.2, // upper and lower are ~1.1 in across the side walls
  tubeR: 1.148 * IN / 2,
  tubeLen: 7.25 * IN,
  flashHider: 43, // A2 birdcage beyond the muzzle
};
D.upperRear = -D.upperLen;
D.muzzle = D.boltFace + D.barrel;
D.tip = D.muzzle + D.flashHider;
D.butt = D.tip - D.oal; // stock fully extended
D.buttCollapsed = D.tip - D.oalCollapsed;
D.towerFront = D.upperRear;
D.towerRear = D.upperRear - 12;
D.tubeEnd = D.towerRear - D.tubeLen + 12; // ~12 mm of thread sits inside the tower
