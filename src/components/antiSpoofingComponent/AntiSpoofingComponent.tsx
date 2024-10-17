import * as faceapi from "face-api.js";
import { useEffect, useRef, useState } from "react";
import styles from "./AntiSpoofingComponent.module.css";
import Image from "next/image";

// Variable para almacenar el ID del intervalo
let intervalId: NodeJS.Timeout;

// Corrección a la orientación del rostro (debe estar entre 0 y 25)
const correctFaceToTheLeft = 15;
const correctFaceToTheRight = 15;

// Umbral de detección de la sonrisa (debe estar entre 0 y 1)
const smileDetectionThreshold = 0.8;

// Margen alrededor del rostro detectado en píxeles
const FACE_MARGIN = 100;

// Ancho y alto deseados para la imagen capturada
const FINAL_WIDTH = 300;
const FINAL_HEIGHT = 225;

// Cantidad mínima de mediciones para validar
const MIN_MEASUREMENTS = 10;

const AntiSpoofingComponent = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const [hasLookedLeft, setHasLookedLeft] = useState<boolean>(false);
  const [hasLookedRight, setHasLookedRight] = useState<boolean>(false);
  const [hasLookedCenter, setHasLookedCenter] = useState<boolean>(false);
  const [hasLookedCenterAgain, setHasLookedCenterAgain] =
    useState<boolean>(false);
  const [hasSmiled, setHasSmiled] = useState<boolean>(false);
  const [capturedImage, setCapturedImage] = useState<string>("");
  const [isNecesaryLookToTheLeft, setIsNecesaryLookToTheLeft] =
    useState<boolean>(true);
  const [isNecesaryLookToTheRight, setIsNecesaryLookToTheRight] =
    useState<boolean>(true);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = "/models";
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
    };

    setIsNecesaryLookToTheLeft(Math.random() > 0.5);
    setIsNecesaryLookToTheRight(Math.random() > 0.5);

    loadModels();
  }, []);

  const detectHeadOrientation = (
    landmarks: faceapi.FaceLandmarks68,
    rightEyePositions: number[],
    leftEyePositions: number[]
  ) => {
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

    // Guardar las mediciones actuales en los arrays de las posiciones de los ojos
    leftEyePositions.push(leftEye[0].x);
    const leftEyePositionsLastData = leftEyePositions.slice(-MIN_MEASUREMENTS);

    rightEyePositions.push(rightEye[3].x);
    const rightEyePositionsLastData = rightEyePositions.slice(
      -MIN_MEASUREMENTS
    );

    // Verificar la consistencia del movimiento hacia la izquierda (valores en X del ojo derecho deberían aumentar)
    const isLookingLeftConsistentArray = rightEyePositionsLastData.map(
      (value: number, index: number, array: number[]) => {
        return value > array[index - 1];
      }
    );

    const isLookingLeftConsistentArrayOfPositivesCases =
      isLookingLeftConsistentArray.filter((value: boolean) => {
        return value;
      });

    const isLookingLeftConsistent =
      isLookingLeftConsistentArrayOfPositivesCases.length >
      MIN_MEASUREMENTS - 2;

    // Verificar la consistencia del movimiento hacia la derecha (valores en X del ojo izquierdo deberían disminuir)
    const isLookingRightConsistentArray = leftEyePositionsLastData.map(
      (value: number, index: number, array: number[]) => {
        return value < array[index - 1];
      }
    );

    const isLookingRightConsistentArrayOfPositivesCases =
      isLookingRightConsistentArray.filter((value: boolean) => {
        return value;
      });

    const isLookingRightConsistent =
      isLookingRightConsistentArrayOfPositivesCases.length >
      MIN_MEASUREMENTS - 2;

    // Detectar si está mirando hacia la izquierda (después de mirar al centro)
    if (
      (hasLookedCenter &&
        !hasLookedLeft &&
        nose[0].x + correctFaceToTheLeft > rightEye[3].x &&
        isLookingLeftConsistent) ||
      (!isNecesaryLookToTheLeft && !hasLookedLeft)
    ) {
      setHasLookedLeft(true);
      console.log("Mirada hacia la izquierda detectada");
    }

    // Detectar si está mirando hacia la derecha (después de mirar a la izquierda)
    if (
      (hasLookedLeft &&
        !hasLookedRight &&
        nose[0].x - correctFaceToTheRight < leftEye[0].x &&
        isLookingRightConsistent) ||
      (!isNecesaryLookToTheRight && !hasLookedRight)
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

  const detectSmile = (
    expressions: faceapi.FaceExpressions,
    detection: faceapi.WithFaceLandmarks<
      { detection: faceapi.FaceDetection },
      faceapi.FaceLandmarks68
    >
  ) => {
    if (
      expressions.happy > smileDetectionThreshold &&
      hasLookedLeft &&
      hasLookedRight &&
      hasLookedCenterAgain &&
      capturedImage === ""
    ) {
      setHasSmiled(true);
      console.log("Sonrisa detectada: ", expressions.happy);

      // Capturar la imagen del video cuando se detecta la sonrisa
      const video = videoRef.current;
      if (video) {
        const tempCanvas = document.createElement("canvas");
        const context = tempCanvas.getContext("2d");

        if (context) {
          // Obtenemos las coordenadas del rostro y aplicamos el margen
          let { x, y, width, height } = detection.detection.box;

          // Ajustamos las coordenadas para incluir el margen
          x = Math.max(x - FACE_MARGIN, 0);
          y = Math.max(y - FACE_MARGIN, 0);
          width = Math.min(width + FACE_MARGIN * 2, video.videoWidth - x);
          height = Math.min(height + FACE_MARGIN * 2, video.videoHeight - y);

          // Establecemos el tamaño del canvas original al tamaño del área ajustada
          tempCanvas.width = width;
          tempCanvas.height = height;

          // Dibujamos solo la región del rostro en el canvas original
          context.drawImage(video, x, y, width, height, 0, 0, width, height);

          // Crear un nuevo canvas para redimensionar la imagen a 300x225
          const resizedCanvas = document.createElement("canvas");
          resizedCanvas.width = FINAL_WIDTH;
          resizedCanvas.height = FINAL_HEIGHT;
          const resizedContext = resizedCanvas.getContext("2d");

          if (resizedContext) {
            // Dibujamos la imagen recortada en el nuevo canvas redimensionado
            resizedContext.drawImage(
              tempCanvas,
              0,
              0,
              width,
              height,
              0,
              0,
              FINAL_WIDTH,
              FINAL_HEIGHT
            );

            // Convertimos el canvas redimensionado a una imagen en base64
            const base64Image = resizedCanvas.toDataURL("image/png");
            setCapturedImage(base64Image); // Guardar la imagen redimensionada en base64
            console.log(
              "Imagen recortada y redimensionada capturada en base64"
            );
          }

          // Limpiar el intervalo después de capturar la imagen
          if (intervalId) {
            clearInterval(intervalId);
          }
        }
      }
    }
  };

  // Función para manejar el reinicio del proceso
  const handleReset = () => {
    setHasLookedLeft(false);
    setHasLookedRight(false);
    setHasLookedCenter(false);
    setHasLookedCenterAgain(false);
    setHasSmiled(false);
    setCapturedImage(""); // Limpiar la imagen capturada
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

          let rightEyePositions: number[] = [];
          let leftEyePositions: number[] = [];

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

              detectHeadOrientation(
                landmarks,
                rightEyePositions,
                leftEyePositions
              ); // Detectar la orientación de la cabeza
              detectSmile(expressions, resizedDetections[0]); // Detectar sonrisa y capturar rostro

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
          <div className={styles.imageContainer}>
            {capturedImage.length > 50 ? (
              <Image
                src={capturedImage}
                alt="Imagen capturada"
                width={FINAL_WIDTH}
                height={FINAL_HEIGHT}
              />
            ) : (
              <div className={styles.imageContainerError}>
                <p>Error al cargar la imagen</p>
                <p>Por favor reinicie la captura</p>
              </div>
            )}

            {/* Botón para reiniciar la captura */}
            <button
              className={styles.buttonReset}
              onClick={() => {
                handleReset();
              }}
            >
              Reiniciar captura
            </button>
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
