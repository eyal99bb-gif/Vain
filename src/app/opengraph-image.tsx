import { ImageResponse } from "next/og";

// A pasted MIDA link used to render as a bare grey card in WhatsApp — the
// main distribution channel for an Israeli consumer app.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "MIDA — תמדוד לפני שאתה קונה";

/**
 * Satori lays glyphs out in string order and implements no bidi algorithm,
 * so Hebrew renders backwards (direction: rtl does not help). Reversing the
 * source string makes it read correctly right-to-left in the output.
 */
const rtl = (text: string) => [...text].reverse().join("");

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf6f1",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 128, fontWeight: 800, color: "#2b2118", letterSpacing: -4 }}>
          MIDA
        </div>
        <div style={{ display: "flex", fontSize: 52, color: "#be123c", marginTop: 8 }}>
          {rtl("תמדוד. אל תנחש.")}
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#6f6558", marginTop: 28 }}>
          {rtl("הלבשה וירטואלית והמלצת מידה מכל חנות אונליין")}
        </div>
        <div style={{ display: "flex", width: 320, height: 6, background: "#e11d48", borderRadius: 3, marginTop: 44 }} />
      </div>
    ),
    size
  );
}
