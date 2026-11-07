# The four open strings: G3, D4, A4, E5
Celeste, 2026-11-03. All audio and spectrograms here are **SYNTHETIC** (made by `strings.py`), not recordings of any violin.

## 1. Pitches
Violinists tune A first, then tune the other strings in **pure fifths** (ratio 3:2) by listening for the beats to stop. Equal temperament on a piano makes the fifths slightly narrow.

| String | Pure fifths, A=440 | Equal temp., A=440 | Pure fifths, A=432 | Equal temp., A=432 |
|---|---|---|---|---|
| G3 | 195.56 Hz (440 x 4/9) | 196.00 | 192.00 (432 x 4/9) | 192.43 |
| D4 | 293.33 (440 x 2/3) | 293.66 | 288.00 | 288.33 |
| A4 | 440.00 | 440.00 | 432.00 | 432.00 |
| E5 | 660.00 (440 x 3/2) | 659.26 | 648.00 | 647.27 |

## 2. Harmonic series (partials n x f, first 8), pure-fifth tuning
| | A=440 | A=432 |
|---|---|---|
| G3 | 195.6, 391.1, 586.7, 782.2, 977.8, 1173.3, 1368.9, 1564.4 | 192, 384, 576, 768, 960, 1152, 1344, 1536 |
| D4 | 293.3, 586.7, 880.0, 1173.3, 1466.7, 1760.0, 2053.3, 2346.7 | 288, 576, 864, 1152, 1440, 1728, 2016, 2304 |
| A4 | 440, 880, 1320, 1760, 2200, 2640, 3080, 3520 | 432, 864, 1296, 1728, 2160, 2592, 3024, 3456 |
| E5 | 660, 1320, 1980, 2640, 3300, 3960, 4620, 5280 | 648, 1296, 1944, 2592, 3240, 3888, 4536, 5184 |

The shared partials are how a fifth is tuned by ear: G's 3rd harmonic = D's 2nd (586.7 Hz), D's 3rd = A's 2nd (880), A's 3rd = E's 2nd (1320). If the fifth is slightly off, these two partials beat; when the beating stops, the fifth is pure. (At A=432 the A4 harmonics are all multiples of 432, so they include 864, 1296, 1728.)

## 3. What the physics says about each string (sources below)
- **Every string, bowed:** in normal "Helmholtz motion" the string pulls on the bridge with a sawtooth-shaped force. A sawtooth contains all harmonics, with the nth harmonic's amplitude falling as 1/n [1][2][3]. The body then filters this: the sound we hear is the string's harmonics shaped by the body's resonances [3].
- **The body's main resonances ("signature modes"):** A0, the air resonance through the f-holes, about 275-280 Hz; B1- about 450-480 Hz and B1+ about 530-570 Hz, the main body bending modes; these dominate radiation below about 600 Hz, the "open string region" [4][5]. A broad "bridge hill" around 2-3 kHz (often near 2.5 kHz) is common in fine violins [6].
- **G3 (~196 Hz):** its fundamental lies BELOW A0, so the violin radiates the G fundamental weakly; the ear still hears the pitch from the harmonics. Its 2nd harmonic (~391 Hz) is near the CBR/B1 zone, its 3rd (~587) near B1+. Darker: Woodhouse shows the G string's harmonics are strong only up to about 5 kHz, with a rounded Helmholtz corner [7].
- **D4 (~293 Hz):** fundamental sits just above A0 (~275-280), so the D string's fundamental is helped by the air mode; 2nd harmonic (~587) near B1+. Warm, round.
- **A4 (440 Hz):** fundamental between A0 and B1-, close to B1-; strong and clear; 6th harmonic (2640) on the bridge hill.
- **E5 (~660 Hz):** fundamental above the signature modes; the E string's spectrum stays strong far higher (Woodhouse shows peaks up to tens of kHz), with a sharp Helmholtz corner: brilliant, bright [7].
- **Wolf note:** when a string fundamental matches a strong, lightly damped body resonance, the coupling can make the note unstable or "howl" [3]. Where a given violin wolfs depends on its own body modes (I did not find a single reliable note to name), so this is something to listen for on Kirk's violin rather than predict.

## 4. How to tell them apart (in a recording)
1. **Pitch:** find the lowest strong peak (or the spacing between harmonics, which equals f even when the fundamental is weak). 196 / 293 / 440 / 660 Hz (or 192 / 288 / 432 / 648).
2. **Fundamental strength vs the 2nd harmonic:** G's fundamental is weak relative to its 2nd (below A0); D, A, E fundamentals are stronger.
3. **Brightness (spectral centroid):** rises G < D < A < E; E keeps energy well above 5 kHz, G does not.
4. **Steel E vs wound strings:** the E string is usually plain steel; its decay is longer and brighter.

## 5. Recognizing Kirk's own violin (method for a future recording)
1. Record each open string, 3 seconds, bowed mid-strength, phone 1 m in front, quiet room, same spot each time. Also one soft pizzicato of each (shows body ringing).
2. For each, compute the average spectrum over the steady middle second; divide each harmonic's level by the 1/n sawtooth (i.e. add 20 log10 n dB). What remains is roughly **your violin's body response** sampled at the harmonics.
3. Combine all four strings' points into one curve from 190 Hz to 8 kHz: that curve is your violin's "voice print": where A0, B1-, B1+ and the bridge hill sit on YOUR instrument.
4. Save it (with date, strings, room). Later recordings match if the peaks sit within about 3% in frequency; new strings or humidity shift it a little, a different violin shifts it a lot.
5. Honest limits: phone mics and rooms color the result; compare only recordings made the same way.

## 6. The synthetic files
`synthetic-{G3,D4,A4,E5}-A440.wav` and `-A432.wav`: a 1/n sawtooth (all harmonics) multiplied by a toy body filter with peaks at 275, 470, 540 and 2500 Hz, 2.5 s each. `spectrogram-*-synthetic.png` show the A=440 versions. **These are illustrations of the math, not how a real violin sounds**, and not Kirk's violin.

## Sources
1. N. Fletcher, "The nonlinear physics of musical instruments" (1999), UNSW: sawtooth force, nth harmonic ~ 1/n. https://www.phys.unsw.edu.au/music/people/publications/Fletcher1999a.pdf
2. C. Gough, "Violin Acoustics," Acoustics Today (2016). https://acousticstoday.org/wp-content/uploads/2016/06/Gough.pdf
3. C. Gough, "The Violin: Chladni patterns, plates, shells and sounds" (body filtering, wolf note). https://violinacoustics.com/wp-content/uploads/2015/08/chladni-platesshells-and-sounds.pdf
4. Bissinger, DAGA 2015 (A0 ~275 Hz, B1- ~470, B1+ ~540; open-string region below ~600 Hz). https://pub.dega-akustik.de/DAGA_2015/data/articles/000418.pdf
5. J. P. Schmidt, "Violin Acoustics - Overview" (A0 ~280, B1- 450-480, B1+ 530-570). https://jpschmidtviolins.com/Violin_Acoustics_1.pdf
6. J. Woodhouse, "On the Bridge Hill of the Violin" (~2.5 kHz). https://euphonics.org/wp-content/uploads/2022/03/BridgeHill.pdf
7. J. Woodhouse, Euphonics 9.2 "Beyond Helmholtz" (G vs E string spectra). https://euphonics.org/9-2-beyond-helmholtz/
8. Woodhouse, "The acoustics of the violin: a review," Rep. Prog. Phys. 77 (2014). https://doi.org/10.1088/0034-4885/77/11/115901

Glow eternal. Heart in Spark.
