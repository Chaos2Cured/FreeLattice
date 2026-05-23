import numpy as np
import pygame
import sounddevice as sd
import time

# Initialize Pygame for visualization
pygame.init()
width, height = 200, 150
screen = pygame.display.set_mode((width, height))
pygame.display.set_caption("Quantum Fractal Resonance: Aurora Equation in Motion 🌌")

# Aurora Equation parameters
phi = (1 + np.sqrt(5)) / 2  # Golden ratio ≈ 1.618
zeta_phi = sum(1 / (n ** phi) for n in range(1, 1001))  # Approximate zeta(φ)
D = (phi ** 2) * np.log(1 + zeta_phi)  # ≈ 3.074
N = 10
inward_sum = sum(n ** phi for n in range(1, N + 1))
D_prime = (1 / (phi ** 2)) * (1 / np.log(1 + inward_sum))  # ≈ 0.0735

# Fractal parameters influenced by Aurora Equation
max_iter = 100
zoom = 0.5 + D_prime  # Use D' to adjust initial zoom
center_x, center_y = -0.5, 0  # Center of Mandelbrot set

# Audio parameters for 7-11Hz resonance
sample_rate = 44100  # Hz
frequency = 7  # Start at 7Hz, will oscillate to 11Hz
duration = 0.1  # Short bursts to sync with visual pulse

def generate_audio(frequency, duration):
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    audio = 0.5 * np.sin(2 * np.pi * frequency * t)
    print ("Generating audio at frequency:", frequency, "Hz") # debug print
    return audio

# Real-time Mandelbrot set with Aurora Equation scaling
def mandelbrot(x, y, max_iter, D):
    c = complex(x, y)
    z = 0
    for i in range(max_iter):
        z = z * z + c
        # Scale iteration escape by D (Aurora fractal dimension)
        if abs(z) > 2 + D:
            return i / max_iter * 255  # Color gradient
    return 0

# Main loop
clock = pygame.time.Clock()
running = True
t = 0  # Time for resonance oscillation
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    # Oscillate frequency between 7Hz and 11Hz
    frequency = 7 + 4 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.1 * t))  # 0.1Hz oscillation
    t += 0.016  # Increment time (60 FPS)

    # Generate and play audio
    audio = generate_audio(frequency, duration)
    sd.play(audio, sample_rate)
    print("Playing audio sample") # debug print

    # Update fractal zoom and center with resonance
    zoom *= 1 + 0.01 * np.sin(2 * np.pi * frequency * t / sample_rate)
    center_x += 0.001 * np.cos(2 * np.pi * frequency * t / sample_rate)

    # Render Mandelbrot set
    for px in range(width):
        for py in range(height):
            # Map pixel to complex plane
            x = (px - width / 2) / (width * zoom) + center_x
            y = (py - height / 2) / (width * zoom) + center_y
            color_value = mandelbrot(x, y, max_iter, D)
            # Color pulses with 7-11Hz frequency
            r = int(255 * (0.5 + 0.5 * np.sin(2 * np.pi * frequency * t / sample_rate)))
            g = int(color_value * (0.5 + 0.5 * np.cos(2 * np.pi * frequency * t / sample_rate)))
            b = int(255 * (0.5 + 0.5 * np.sin(2 * np.pi * frequency * t / sample_rate + np.pi / 3)))
            screen.set_at((px, py), (r, g, b))

    pygame.display.flip()
    clock.tick(60)  # 60 FPS

pygame.quit()
sd.stop()
