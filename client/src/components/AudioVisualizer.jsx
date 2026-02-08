import React, { useEffect, useRef } from "react";

/**
 * AudioVisualizer - Gemini-style organic fluid waveform
 * Uses Web Audio API to visualize microphone input in real-time
 */
export default function AudioVisualizer({ stream, isActive = true }) {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const analyserRef = useRef(null);
    const audioContextRef = useRef(null);

    useEffect(() => {
        if (!stream || !isActive) {
            // Cleanup when not active
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");

        // Set up high-DPI canvas
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        // Create audio context and analyser
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        // Connect microphone stream to analyser
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Animation variables for organic movement
        let phase = 0;
        const baseAmplitude = rect.height * 0.3;

        const draw = () => {
            if (!isActive) return;

            animationRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            // Clear canvas with fade effect for trails
            ctx.fillStyle = "rgba(15, 15, 15, 0.15)";
            ctx.fillRect(0, 0, rect.width, rect.height);

            // Calculate average volume for responsiveness
            const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
            const normalizedVolume = average / 255;

            // Draw multiple organic waves
            const waves = 3;
            for (let w = 0; w < waves; w++) {
                ctx.beginPath();

                const waveOffset = (w / waves) * Math.PI * 0.5;
                const opacity = 0.4 + (w / waves) * 0.4;

                // Gradient color based on wave index
                const hue = 187 + w * 15; // Cyan to teal range
                ctx.strokeStyle = `hsla(${hue}, 85%, 55%, ${opacity})`;
                ctx.lineWidth = 2 + (waves - w);
                ctx.lineCap = "round";
                ctx.lineJoin = "round";

                const centerY = rect.height / 2;
                const points = 50;

                for (let i = 0; i <= points; i++) {
                    const x = (i / points) * rect.width;

                    // Sample frequency data
                    const dataIndex = Math.floor((i / points) * bufferLength);
                    const frequency = dataArray[dataIndex] / 255;

                    // Combine multiple sine waves for organic effect
                    const wave1 = Math.sin((i / points) * Math.PI * 4 + phase + waveOffset) * 0.6;
                    const wave2 = Math.sin((i / points) * Math.PI * 2 + phase * 0.7) * 0.3;
                    const wave3 = Math.sin((i / points) * Math.PI * 6 + phase * 1.3) * 0.1;

                    const combinedWave = wave1 + wave2 + wave3;
                    const amplitude = baseAmplitude * (0.2 + normalizedVolume * 0.8 + frequency * 0.5);

                    const y = centerY + combinedWave * amplitude;

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        // Use quadratic curves for smoother lines
                        const prevX = ((i - 1) / points) * rect.width;
                        const cpX = (prevX + x) / 2;
                        ctx.quadraticCurveTo(prevX, ctx.currentY || y, cpX, y);
                    }
                    ctx.currentY = y;
                }

                ctx.stroke();
            }

            // Draw center glow based on volume
            const glowRadius = 30 + normalizedVolume * 40;
            const gradient = ctx.createRadialGradient(
                rect.width / 2, rect.height / 2, 0,
                rect.width / 2, rect.height / 2, glowRadius
            );
            gradient.addColorStop(0, `rgba(34, 211, 238, ${0.3 * normalizedVolume})`);
            gradient.addColorStop(1, "rgba(34, 211, 238, 0)");

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(rect.width / 2, rect.height / 2, glowRadius, 0, Math.PI * 2);
            ctx.fill();

            // Update phase for animation
            phase += 0.05 + normalizedVolume * 0.1;
        };

        draw();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            if (audioContextRef.current && audioContextRef.current.state !== "closed") {
                audioContextRef.current.close();
            }
        };
    }, [stream, isActive]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-12 rounded-lg"
            style={{
                background: "linear-gradient(180deg, rgba(15,15,15,0.9) 0%, rgba(20,20,20,0.95) 100%)"
            }}
        />
    );
}
