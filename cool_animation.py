#!/usr/bin/env python3
import time
import math
import sys

def clear_screen():
    print("\033[2J\033[H", end="")

def color(r, g, b, text):
    return f"\033[38;2;{r};{g};{b}m{text}\033[0m"

def draw_wave(frame):
    width = 60
    height = 20
    output = []

    for y in range(height):
        line = ""
        for x in range(width):
            # Create multiple sine waves
            wave1 = math.sin(x / 5.0 + frame / 10.0) * 5
            wave2 = math.sin(x / 3.0 - frame / 15.0) * 3
            wave3 = math.cos(x / 7.0 + frame / 8.0) * 4

            wave_y = height / 2 + wave1 + wave2 + wave3

            # Calculate distance from wave
            distance = abs(y - wave_y)

            if distance < 0.5:
                # Rainbow colors based on position and time
                hue = (x * 6 + frame * 2) % 360
                r = int((math.sin(hue * 0.01745) + 1) * 127)
                g = int((math.sin((hue + 120) * 0.01745) + 1) * 127)
                b = int((math.sin((hue + 240) * 0.01745) + 1) * 127)
                line += color(r, g, b, "█")
            elif distance < 1.5:
                # Fade effect
                hue = (x * 6 + frame * 2) % 360
                r = int((math.sin(hue * 0.01745) + 1) * 63)
                g = int((math.sin((hue + 120) * 0.01745) + 1) * 63)
                b = int((math.sin((hue + 240) * 0.01745) + 1) * 63)
                line += color(r, g, b, "▒")
            else:
                line += " "
        output.append(line)

    return "\n".join(output)

def main():
    print("Press Ctrl+C to exit...\n")
    time.sleep(1)

    frame = 0
    try:
        while True:
            clear_screen()
            print(color(255, 255, 255, "🌊 RAINBOW WAVE ANIMATION 🌊\n"))
            print(draw_wave(frame))
            print(color(100, 100, 100, f"\nFrame: {frame}"))
            frame += 1
            time.sleep(0.05)
    except KeyboardInterrupt:
        clear_screen()
        print(color(255, 100, 255, "\n✨ Thanks for watching! ✨\n"))

if __name__ == "__main__":
    main()
