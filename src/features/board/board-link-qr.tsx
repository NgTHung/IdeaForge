"use client";

import { useId, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

export function BoardLinkQr({ url }: { url: string }) {
  const dialogId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const code = <QRCodeSVG value={url} size={360} level="M" marginSize={4} bgColor="#ffffff" fgColor="#000000" role="img" aria-label="QR code to open this board" />;

  return <div className="board-share-qr" onKeyDownCapture={(event) => {
    if (!dialog.current?.open && event.key === "Escape") return;
    event.stopPropagation();
    if (dialog.current?.open && event.key === "Tab") {
      event.preventDefault();
      dialog.current.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }}>
    <button ref={trigger} type="button" className="board-share-qr-trigger" aria-label="Enlarge board QR code" aria-haspopup="dialog" aria-controls={dialogId}
      onClick={() => dialog.current?.showModal()}>
      {code}<span>Click to enlarge</span>
    </button>
    <p>Scan to open this board</p>
    <dialog ref={dialog} id={dialogId} className="board-share-qr-dialog" aria-labelledby={`${dialogId}-title`}
      onClose={() => trigger.current?.focus()}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
      }}>
      <div className="board-share-popover-heading"><h2 id={`${dialogId}-title`}>Open this board</h2>
        <button type="button" aria-label="Close enlarged QR code" onClick={() => dialog.current?.close()}>×</button></div>
      {code}
      <p>Scan with your phone camera</p>
    </dialog>
  </div>;
}
