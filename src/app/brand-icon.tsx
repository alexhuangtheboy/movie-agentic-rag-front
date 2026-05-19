type BrandIconProps = {
  size: number;
};

/** Shared markup for app/icon and app/apple-icon (ImageResponse / next/og). */
export function BrandIcon({ size }: BrandIconProps) {
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.52);
  const ringWidth = Math.max(2, Math.round(size * 0.06));
  const dotSize = Math.max(3, Math.round(size * 0.1));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #010828 0%, #0c1a4a 55%, #010828 100%)",
        borderRadius: radius,
        position: "relative",
        border: `${ringWidth}px solid #6fff00`,
        boxShadow: `inset 0 0 ${Math.round(size * 0.35)}px rgba(111, 255, 0, 0.15)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: Math.round(size * 0.12),
          right: Math.round(size * 0.12),
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          background: "#6fff00",
          boxShadow: `0 0 ${Math.round(size * 0.12)}px #6fff00`,
        }}
      />
      <span
        style={{
          fontSize,
          fontWeight: 800,
          color: "#eff4ff",
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "-0.04em",
          lineHeight: 1,
          marginTop: Math.round(size * 0.02),
        }}
      >
        A
      </span>
    </div>
  );
}
