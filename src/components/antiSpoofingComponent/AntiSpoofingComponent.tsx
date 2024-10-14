import * as faceapi from "face-api.js";
import { useEffect, useRef, useState } from "react";
import styles from "./AntiSpoofingComponent.module.css";
import Image from "next/image";

// Variable para almacenar el ID del intervalo
let intervalId: NodeJS.Timeout;

// Corrección a la orientación del rostro
const correctFaceToTheLeft = 15;
const correctFaceToTheRight = 15;

// Umbral de detección de la sonrisa (debe estar entre 0 y 1)
const smileDetectionThreshold = 0.8;

const AntiSpoofingComponent = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [hasLookedLeft, setHasLookedLeft] = useState(false);
  const [hasLookedRight, setHasLookedRight] = useState(false);
  const [hasLookedCenter, setHasLookedCenter] = useState(false);
  const [hasLookedCenterAgain, setHasLookedCenterAgain] = useState(false);
  const [hasSmiled, setHasSmiled] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>("");

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = "/models";
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
    };

    loadModels();
  }, []);

  const detectHeadOrientation = (landmarks: faceapi.FaceLandmarks68) => {
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    // Detectar si está mirando hacia el centro primero
    if (
      !hasLookedCenter &&
      nose[0].x > leftEye[3].x &&
      nose[0].x < rightEye[0].x
    ) {
      setHasLookedCenter(true);
      console.log("Mirada hacia el centro detectada (primer paso)");
    }

    // Detectar si está mirando hacia la izquierda (después de mirar al centro)
    if (
      hasLookedCenter &&
      !hasLookedLeft &&
      nose[0].x + correctFaceToTheLeft > rightEye[3].x
    ) {
      setHasLookedLeft(true);
      console.log("Mirada hacia la izquierda detectada");
    }

    // Detectar si está mirando hacia la derecha (después de mirar a la izquierda)
    if (
      hasLookedLeft &&
      !hasLookedRight &&
      nose[0].x - correctFaceToTheRight < leftEye[0].x
    ) {
      setHasLookedRight(true);
      console.log("Mirada hacia la derecha detectada");
    }

    // Detectar si está mirando hacia el centro nuevamente (después de mirar a la derecha)
    if (
      hasLookedRight &&
      !hasLookedCenterAgain &&
      nose[0].x > leftEye[3].x &&
      nose[0].x < rightEye[0].x
    ) {
      setHasLookedCenterAgain(true);
      console.log("Mirada hacia el centro detectada (último paso)");
    }
  };

  const detectSmile = (expressions: faceapi.FaceExpressions) => {
    if (
      expressions.happy > smileDetectionThreshold &&
      hasLookedCenterAgain &&
      capturedImage === ""
    ) {
      setHasSmiled(true);
      console.log("Sonrisa detectada: ", expressions.happy);

      // Capturar la imagen del video cuando se detecta la sonrisa
      const video = videoRef.current;
      if (video) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const context = tempCanvas.getContext("2d");
        if (context) {
          context.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
          const base64Image = tempCanvas.toDataURL("image/png");
          setCapturedImage(base64Image); // Guardar la imagen en base64
          console.log("Imagen capturada en base64");

          // Limpiar el intervalo después de capturar la imagen
          if (intervalId) {
            clearInterval(intervalId);
          }
        }
      }
    }
  };

  useEffect(() => {
    if (modelsLoaded && videoRef.current) {
      const video = videoRef.current;

      const startVideo = async () => {
        navigator.mediaDevices.getUserMedia({ video: {} }).then((stream) => {
          video.srcObject = stream;
        });

        video.addEventListener("play", async () => {
          const canvas: any = canvasRef.current;
          const displaySize = { width: video.width, height: video.height };
          faceapi.matchDimensions(canvas, displaySize);

          // Limpiar el intervalo anterior si existe
          if (intervalId) {
            clearInterval(intervalId);
          }

          // Iniciar un nuevo intervalo
          intervalId = setInterval(async () => {
            const context = canvas.getContext("2d");
            context.clearRect(0, 0, canvas.width, canvas.height);

            const detections = await faceapi
              .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
              .withFaceLandmarks()
              .withFaceExpressions();

            if (detections.length > 0) {
              const resizedDetections = faceapi.resizeResults(
                detections,
                displaySize
              );
              const landmarks = resizedDetections[0].landmarks;
              const expressions = resizedDetections[0].expressions;

              detectHeadOrientation(landmarks); // Detectar la orientación de la cabeza
              detectSmile(expressions); // Detectar sonrisa

              faceapi.draw.drawDetections(canvas, resizedDetections);
              faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
            } else {
              console.log("No se detectaron caras.");
            }
          }, 100); // Mantener el intervalo corto para mejor detección
        });
      };

      startVideo();

      // Limpieza del intervalo cuando el componente se desmonta
      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }
  }, [
    modelsLoaded,
    hasLookedCenter,
    hasLookedLeft,
    hasLookedRight,
    hasLookedCenterAgain,
    hasSmiled,
    capturedImage,
  ]);

  return (
    <section className={styles.section}>
      <article>
        <p style={{ color: "white" }}>
          {modelsLoaded ? "Modelos cargados" : "Cargando modelos..."}
        </p>
        <p style={{ color: "white" }}>
          {hasLookedCenter
            ? "Mirada hacia el centro detectada (primer paso)"
            : "Cargando landmarks..."}
        </p>
        <p style={{ color: "white" }}>
          {hasLookedLeft
            ? "Mirada hacia la izquierda detectada (segundo paso)"
            : hasLookedCenter
            ? "Mira hacia la izquierda"
            : "..."}
        </p>
        <p style={{ color: "white" }}>
          {hasLookedRight
            ? "Mirada hacia la derecha detectada (tercer paso)"
            : hasLookedLeft
            ? "Mira hacia la derecha"
            : "..."}
        </p>
        <p style={{ color: "white" }}>
          {hasLookedCenterAgain
            ? "Mirada hacia el centro detectada (cuarto paso)"
            : hasLookedRight
            ? "Mira hacia el centro nuevamente"
            : "..."}
        </p>
        <p style={{ color: "white" }}>
          {hasSmiled
            ? "Sonrisa detectada (último paso)"
            : hasLookedCenterAgain
            ? "Sonríe para completar la secuencia"
            : "..."}
        </p>
        <p style={{ color: "white" }}>
          {hasLookedCenter &&
          hasLookedLeft &&
          hasLookedRight &&
          hasLookedCenterAgain &&
          hasSmiled
            ? "Secuencia completada correctamente"
            : "Secuencia incompleta"}
        </p>

        {capturedImage !== "" && (
          <div>
            <Image
              src={capturedImage}
              alt="Imagen capturada"
              width={420}
              height={315}
            />
          </div>
        )}
      </article>

      <div className={styles.container}>
        <video
          className={styles.video}
          ref={videoRef}
          autoPlay
          muted
          width={560}
          height={420}
        />
        <canvas
          className={styles.canvas}
          ref={canvasRef}
          width={560}
          height={420}
        />
      </div>
    </section>
  );
};

export default AntiSpoofingComponent;
