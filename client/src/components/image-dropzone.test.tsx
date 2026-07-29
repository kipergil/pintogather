import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ImageDropzone, screenImages, MAX_IMAGES, MAX_IMAGE_BYTES } from "./image-dropzone";

const png = (name: string, bytes = 10) => new File([new Uint8Array(bytes)], name, { type: "image/png" });

describe("screenImages", () => {
  it("accepts images under the size and count limits", () => {
    const { accepted, rejected } = screenImages([png("a.png"), png("b.png")], 0);
    expect(accepted).toHaveLength(2);
    expect(rejected).toHaveLength(0);
  });

  it.each([
    ["text/plain", "notes.txt"],
    ["application/pdf", "doc.pdf"],
    ["image/svg+xml", "vector.svg"],
  ])("rejects %s as the wrong type", (type, name) => {
    const { accepted, rejected } = screenImages([new File(["x"], name, { type })], 0);
    expect(accepted).toHaveLength(0);
    expect(rejected[0]).toEqual({ name, reason: "type" });
  });

  it.each([
    ["image/png", "a.png"],
    ["image/jpeg", "a.jpg"],
    ["image/webp", "a.webp"],
    ["image/gif", "a.gif"],
  ])("accepts %s", (type, name) => {
    const { accepted } = screenImages([new File(["x"], name, { type })], 0);
    expect(accepted).toHaveLength(1);
  });

  it("rejects an image over the size cap but keeps one exactly at it", () => {
    const over = screenImages([png("huge.png", MAX_IMAGE_BYTES + 1)], 0);
    expect(over.rejected[0].reason).toBe("size");

    const exact = screenImages([png("edge.png", MAX_IMAGE_BYTES)], 0);
    expect(exact.accepted).toHaveLength(1);
  });

  it("caps the batch at MAX_IMAGES", () => {
    const files = Array.from({ length: MAX_IMAGES + 2 }, (_, i) => png(`${i}.png`));
    const { accepted, rejected } = screenImages(files, 0);
    expect(accepted).toHaveLength(MAX_IMAGES);
    expect(rejected).toHaveLength(2);
    expect(rejected.every((r) => r.reason === "count")).toBe(true);
  });

  it("counts images already held against the cap", () => {
    const { accepted, rejected } = screenImages([png("x.png"), png("y.png")], MAX_IMAGES - 1);
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe("count");
  });

  it("reports every distinct reason in one pass", () => {
    const { accepted, rejected } = screenImages(
      [png("ok.png"), new File(["x"], "bad.txt", { type: "text/plain" }), png("big.png", MAX_IMAGE_BYTES + 1)],
      0,
    );
    expect(accepted.map((f) => f.name)).toEqual(["ok.png"]);
    expect(rejected.map((r) => r.reason).sort()).toEqual(["size", "type"]);
  });
});

/** Wraps the controlled component so tests can drive it the way the page does. */
function Harness({ onRejected }: { onRejected?: (r: unknown[]) => void } = {}) {
  const [images, setImages] = useState<File[]>([]);
  return (
    <>
      <ImageDropzone images={images} onChange={setImages} onRejected={onRejected as never} testId="dz" />
      <span data-testid="count">{images.length}</span>
    </>
  );
}

/** Builds a paste event carrying image data, the way a screenshot arrives. */
function pasteImage(file: File) {
  const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
    clipboardData: unknown;
  };
  Object.defineProperty(event, "clipboardData", {
    value: { items: [{ kind: "file", type: file.type, getAsFile: () => file }] },
  });
  document.dispatchEvent(event);
  return event;
}

describe("<ImageDropzone />", () => {
  it("renders the drop target and holds nothing initially", () => {
    render(<Harness />);
    expect(screen.getByTestId("dz-target")).toBeInTheDocument();
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("captures an image pasted anywhere on the page", async () => {
    // Screenshots live on the clipboard, not on disk — this is the primary
    // path, not a convenience.
    render(<Harness />);
    pasteImage(png("screenshot.png"));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(screen.getByTestId("dz-thumbs")).toBeInTheDocument();
  });

  it("ignores a paste with no image, so pasting text still behaves normally", () => {
    render(<Harness />);
    const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    Object.defineProperty(event, "clipboardData", {
      value: { items: [{ kind: "string", type: "text/plain", getAsFile: () => null }] },
    });
    document.dispatchEvent(event);
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(event.defaultPrevented).toBe(false);
  });

  it("swallows the paste event only when it carried an image", () => {
    render(<Harness />);
    const event = pasteImage(png("shot.png"));
    expect(event.defaultPrevented).toBe(true);
  });

  it("accepts an image dropped onto the target", async () => {
    render(<Harness />);
    const target = screen.getByTestId("dz-target");
    fireEvent.drop(target, { dataTransfer: { files: [png("dropped.png")] } });
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
  });

  it("accepts images chosen through the file picker", async () => {
    render(<Harness />);
    await userEvent.upload(screen.getByTestId("dz-input"), [png("a.png"), png("b.png")]);
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
  });

  it("removes a single image without touching the others", async () => {
    render(<Harness />);
    await userEvent.upload(screen.getByTestId("dz-input"), [png("a.png"), png("b.png")]);
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

    await userEvent.click(screen.getByTestId("dz-remove-0"));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(screen.getByAltText("b.png")).toBeInTheDocument();
  });

  it("hides the drop target once at capacity", async () => {
    render(<Harness />);
    const files = Array.from({ length: MAX_IMAGES }, (_, i) => png(`${i}.png`));
    await userEvent.upload(screen.getByTestId("dz-input"), files);
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent(String(MAX_IMAGES)));
    expect(screen.queryByTestId("dz-target")).not.toBeInTheDocument();
  });

  it("reports rejections to the caller instead of dropping them silently", async () => {
    // Dropped rather than picked: the file input carries accept="image/*",
    // so the picker path never sees a .txt in the first place — drag-and-drop
    // is where a wrong type actually reaches the component.
    const onRejected = vi.fn();
    render(<Harness onRejected={onRejected} />);
    fireEvent.drop(screen.getByTestId("dz-target"), {
      dataTransfer: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] },
    });
    await waitFor(() => expect(onRejected).toHaveBeenCalled());
    expect(onRejected.mock.calls[0][0]).toEqual([{ name: "notes.txt", reason: "type" }]);
  });

  it("ignores paste while disabled", () => {
    const onChange = vi.fn();
    render(<ImageDropzone images={[]} onChange={onChange} disabled testId="dz" />);
    pasteImage(png("shot.png"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores a drop while disabled", () => {
    const onChange = vi.fn();
    render(<ImageDropzone images={[]} onChange={onChange} disabled testId="dz" />);
    fireEvent.drop(screen.getByTestId("dz-target"), { dataTransfer: { files: [png("a.png")] } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
