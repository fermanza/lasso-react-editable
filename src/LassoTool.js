import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Line, Circle, Image as KonvaImage } from 'react-konva';

const FreehandLineTool = ({ imageUrl, width, height }) => {
  // States for freehand drawing, the background image, and editing mode.
  const [points, setPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: width / 2, y: height / 2 });

  // Refs for tracking mouse movement speed.
  const lastMoveTime = useRef(Date.now());
  const lastMousePos = useRef({ x: width / 2, y: height / 2 });

  // ----- IMAGE LOADING ----- //
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => setBackgroundImage(img);
  }, [imageUrl]);

  // ----- INITIAL DRAWING HANDLERS ----- //
  const handleMouseDown = (e) => {
    // Only allow drawing if not in editing mode.
    if (!editing) {
      const stage = e.target.getStage();
      const point = stage.getPointerPosition();
      setIsDrawing(true);
      setPoints([point.x, point.y]);
    }
  };

  const handleMouseMove = (e) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    setMousePosition(point);
    if (isDrawing) {
      setPoints((prevPoints) => [...prevPoints, point.x, point.y]);
    }
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      // Automatically close the shape.
      if (points.length > 4) {
        setPoints((prevPoints) => [...prevPoints, prevPoints[0], prevPoints[1]]);
      }
      // After 1 second, enable editing mode.
      setTimeout(() => {
        setEditing(true);
      }, 1000);
    }
  };

  // ----- EDITING: FORCE-LIKE EFFECT ----- //
  useEffect(() => {
    // Only run if editing mode is active and we have a valid shape.
    if (!editing || points.length < 6) return;

    const influenceRadius = 15;       // Collision circle radius
    const dampingFactor = 0.1;          // How strongly to nudge the point
    const speedThreshold = 0.5;         // Only update if mouse is moving slowly (pixels per ms)

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const dt = currentTime - lastMoveTime.current || 1;
      // Compute the speed of mouse movement.
      const dx = mousePosition.x - lastMousePos.current.x;
      const dy = mousePosition.y - lastMousePos.current.y;
      const speed = Math.sqrt(dx * dx + dy * dy) / dt;

      lastMoveTime.current = currentTime;
      lastMousePos.current = { ...mousePosition };

      // Only apply force if the mouse is moving slowly.
      if (speed >= speedThreshold) return;

      // Update points in pairs.
      const newPoints = [];
      for (let i = 0; i < points.length; i += 2) {
        let x = points[i];
        let y = points[i + 1];
        const dist = Math.sqrt((x - mousePosition.x) ** 2 + (y - mousePosition.y) ** 2);
        if (dist <= influenceRadius) {
          const angle = Math.atan2(mousePosition.y - y, mousePosition.x - x);
          // Calculate how much to move. The closer the point is to the mouse,
          // the more it is nudged; if it's at the edge of influence, nearly zero.
          const moveAmount = dampingFactor * (influenceRadius - dist);
          x += Math.cos(angle) * moveAmount;
          y += Math.sin(angle) * moveAmount;
        }
        newPoints.push(x, y);
      }
      setPoints(newPoints);
    }, 30);

    return () => clearInterval(interval);
  }, [editing, mousePosition, points]);

  // ----- EXPORT CLIPPED AREA ----- //
  // This function uses the freehand shape drawn on the Stage to clip a portion of the background image and export only that area.
  function downloadClippedArea() {
    if (!backgroundImage || points.length < 6) return;

    // Create a full‑sized canvas using the natural dimensions of the background image.
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = backgroundImage.width;
    fullCanvas.height = backgroundImage.height;
    const fullCtx = fullCanvas.getContext('2d');

    // Draw the full image on the canvas.
    fullCtx.drawImage(backgroundImage, 0, 0, fullCanvas.width, fullCanvas.height);

    // Create a mask canvas and render the freehand shape on it.
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = fullCanvas.width;
    maskCanvas.height = fullCanvas.height;
    const maskCtx = maskCanvas.getContext('2d');

    // Draw the freehand shape on the mask.
    // Scale the freehand (display) points to the natural image dimensions if needed.
    maskCtx.fillStyle = 'black';
    maskCtx.beginPath();
    maskCtx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) {
      maskCtx.lineTo(points[i], points[i + 1]);
    }
    maskCtx.closePath();
    maskCtx.fill();

    // Apply the mask on the full canvas.
    fullCtx.globalCompositeOperation = 'destination-in';
    fullCtx.drawImage(maskCanvas, 0, 0);

    // Optionally, get the bounding box of the freehand shape.
    const xs = [];
    const ys = [];
    for (let i = 0; i < points.length; i += 2) {
      xs.push(points[i]);
      ys.push(points[i + 1]);
    }
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const bbWidth = Math.max(...xs) - minX;
    const bbHeight = Math.max(...ys) - minY;

    // Create a cropped canvas to extract only the selected area.
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = bbWidth;
    croppedCanvas.height = bbHeight;
    const croppedCtx = croppedCanvas.getContext('2d');

    // Draw only the clipped portion from the full canvas into the cropped canvas.
    croppedCtx.drawImage(fullCanvas, minX, minY, bbWidth, bbHeight, 0, 0, bbWidth, bbHeight);

    const dataURL = croppedCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'clipped-freehand-selection.png';
    link.click();
  }

  return (
      <div>
        <Stage
            width={width}
            height={height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
          <Layer>
            {backgroundImage && (
                <KonvaImage image={backgroundImage} x={0} y={0} width={width} height={height} />
            )}
            <Line
                points={points}
                stroke="blue"
                strokeWidth={2}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                closed={true}
                fill="rgba(0, 255, 0, 0.3)"
            />
            {editing && (
                <Circle
                    x={mousePosition.x}
                    y={mousePosition.y}
                    radius={15}
                    fill="rgba(255,0,0,0.3)"
                />
            )}
          </Layer>
        </Stage>
        <button onClick={downloadClippedArea} disabled={points.length < 6}>
          Download Clipped Area
        </button>
      </div>
  );
};

export default FreehandLineTool;