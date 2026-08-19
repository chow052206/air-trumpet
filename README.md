# Air Trumpet 🎺

An interactive web application that lets you play a virtual trumpet using hand gestures captured through your webcam. Pinch your thumb and index finger together to activate the trumpet, and move your hand up and down to change notes!

## Features

- **Hand Gesture Recognition**: Uses MediaPipe Hands to detect hand landmarks
- **Pinch Detection**: Activate sound by pinching thumb and index finger together
- **Multiple Notes**: Play 22 different notes from C4 to A5
- **Height-Based Pitch Control**: Move your hand higher to play higher notes
- **Web Audio API Synthesis**: Real-time brass-like sound synthesis with smooth envelopes
- **Visual Feedback**: See pinch distance and active note on screen
- **No External Sound Files Required**: All sounds are synthesized in real-time

## How to Use

1. **Start the Application**: Open `index.html` in a modern web browser (Chrome, Firefox, Edge)
2. **Enable Camera**: Click the "Start Camera" button and grant camera permissions
3. **Show Your Hand**: Position your hand clearly in front of the camera
4. **Play Notes**:
   - Pinch your thumb and index finger together to activate the trumpet
   - Move your hand up and down to change the pitch
   - Release the pinch to stop the sound

## Technical Details

### Note Range
The instrument supports 22 notes spanning over two octaves:
- **Lowest Note**: C4 (Middle C, ~261.63 Hz)
- **Highest Note**: A5 (~880 Hz)
- Includes all chromatic notes (sharps/flats) in between

### Gesture Controls
- **Pinch Distance**: Threshold of 0.05 for activation (lower = more sensitive)
- **Height Mapping**: Hand position maps linearly to note selection
- **Visual Indicators**: Green overlay when pinched, red when open

### Audio Synthesis
- Oscillator-based sound generation (sawtooth + sine wave mix)
- Attack and release envelopes for natural sound
- Gain control for smooth transitions

## File Structure

```
air-trumpet/
├── index.html          # Main HTML structure
├── style.css           # Styling and visual effects
├── script.js           # Core logic (gesture detection, audio synthesis)
└── sounds/             # Optional sound files (not used in current version)
    ├── trumpet-c4.wav  # Reference trumpet sound
    └── audio_*.mp3     # Additional audio samples
```

## Dependencies

- **MediaPipe Hands**: For real-time hand tracking ([Documentation](https://google.github.io/mediapipe/solutions/hands))
- **Web Audio API**: Built-in browser API for sound synthesis
- **Modern Browser**: Requires a browser with WebAudio and ES6+ support

## Running Locally

1. Clone or download this repository
2. Serve the files using a local web server (required for camera access):
   ```bash
   # Using Python 3
   python3 -m http.server 8080

   # Using Node.js (npx)
   npx serve .

   # Using PHP
   php -S localhost:8080
   ```
3. Open your browser and navigate to `http://localhost:8080`
4. Click "Start Camera" and begin playing!

## Browser Compatibility

- ✅ Chrome/Chromium (recommended)
- ✅ Firefox
- ✅ Edge
- ⚠️ Safari (may require additional permissions)

## Troubleshooting

**Camera not working?**
- Ensure you've granted camera permissions
- Try using HTTPS or localhost (camera access requires secure context)
- Check if another application is using the camera

**Sound not playing?**
- Make sure your system volume is up
- Some browsers require user interaction before audio can play
- Try clicking anywhere on the page first

**Hand not detected?**
- Ensure good lighting conditions
- Keep your hand fully visible in the frame
- Move your hand closer to the camera if needed

## Future Enhancements

- [ ] Add reverb and effects for more realistic trumpet sound
- [ ] Support for multiple hand gestures (vibrato, mute, etc.)
- [ ] Recording and playback functionality
- [ ] Customizable sensitivity settings
- [ ] Mobile device optimization
- [ ] Multiplayer jam sessions

## License

This project is open source and available for educational purposes.

## Acknowledgments

- MediaPipe team for the excellent hand tracking library
- Web Audio API contributors for enabling real-time audio synthesis

---

Made with 🎵 and JavaScript
