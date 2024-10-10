import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import styles from "./SmileCapture.module.css";
import Image from "next/image";

const SmileCapture: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isSmiling, setIsSmiling] = useState(false);
  const [imageData, setImageData] = useState<string>("");

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = "/models";
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      setIsModelLoaded(true);
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (isModelLoaded) {
      startVideo();
    }
  }, [isModelLoaded]);

  const startVideo = () => {
    navigator.mediaDevices
      .getUserMedia({ video: {} })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => console.error("Error accessing webcam:", err));
  };

  const handleVideoPlay = async () => {
    if (videoRef.current && canvasRef.current) {
      const displaySize = {
        width: videoRef.current.width,
        height: videoRef.current.height,
      };
      faceapi.matchDimensions(canvasRef.current, displaySize);

      setInterval(async () => {
        const detections = await faceapi
          .detectAllFaces(
            videoRef.current!,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks()
          .withFaceExpressions();

        const resizedDetections = faceapi.resizeResults(
          detections,
          displaySize
        );

        canvasRef
          .current!.getContext("2d")
          ?.clearRect(0, 0, displaySize.width, displaySize.height);
        faceapi.draw.drawDetections(canvasRef.current!, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvasRef.current!, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvasRef.current!, resizedDetections);

        const smileProbability = detections[0]?.expressions.happy || 0;
        if (smileProbability > 0.6) {
          // Umbral para detectar la sonrisa
          setIsSmiling(true);
          captureImage();
        } else {
          setIsSmiling(false);
        }
      }, 100);
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        // Establecer el tamaño del lienzo para que coincida con el contenedor
        canvasRef.current.width = 560;
        canvasRef.current.height = 420;

        // Dibujar el video en el lienzo ajustando el tamaño
        context.drawImage(
          videoRef.current,
          0,
          0,
          videoRef.current.videoWidth,
          videoRef.current.videoHeight,
          0,
          0,
          560,
          420
        );

        const data = canvasRef.current.toDataURL("image/png");
        setImageData(data);
      }
    }
  };

  return (
    <section className={styles.SmileCaptureSection}>
      <p className={styles.SmileCaptureText}>
        {isSmiling ? "Sonriendo 😄" : "No sonriendo 😐"}
      </p>
      <article className={styles.SmileCaptureArticle}>
        <div className={styles.SmileCaptureDiv}>
          <video
            ref={videoRef}
            autoPlay
            muted
            onPlay={handleVideoPlay}
            width="560"
            height="420"
            className={styles.SmileCaptureVideo}
          />
          <canvas
            ref={canvasRef}
            width="560"
            height="420"
            className={styles.SmileCaptureCanvas}
          />
        </div>
        {imageData !== null && (
          <Image
            src={imageData}
            alt="Logo"
            className={styles.SmileCaptureImage}
            width={420}
            height={420}
          />
        )}
      </article>
    </section>
  );
};

export default SmileCapture;
