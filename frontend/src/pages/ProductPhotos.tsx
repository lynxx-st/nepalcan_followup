import { useEffect, useRef, useState } from "react";
import { ImageOff, X, ChevronLeft, ChevronRight } from "lucide-react";

type Item = Record<string, any>;
export function productName(item: Item = {}) {
  return typeof item.product === "string" ? item.product : item.product?.productName || item.product?.title || item.productName || item.title || item.name || "Product details unavailable";
}
export function productPhotos(item: Item = {}): string[] {
  const values = [item.variant?.images, item.variant?.image, item.images, item.image, item.imageUrl, item.product?.productImages, item.product?.images].flat(2);
  return [...new Set(values.map(v => typeof v === "string" ? v : v?.url || v?.imageUrl || v?.src).filter((v): v is string => typeof v === "string" && (/^https?:\/\//i.test(v) || /^\/(?!\/)/.test(v))))];
}
export function ProductThumbnail({ item }: { item: Item }) {
  const url = productPhotos(item)[0];
  const [failed, setFailed] = useState("");
  return url && failed !== url ? <img className="product-thumbnail" src={url} alt={productName(item)} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(url)} /> : <span className="product-thumbnail photo-fallback" aria-label="Product photo unavailable"><ImageOff size={20} /></span>;
}
export default function ProductPhotos({ item }: { item: Item }) {
  const photos = productPhotos(item), name = productName(item);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false), [index, setIndex] = useState(0), [failed, setFailed] = useState<string[]>([]);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  if (!photos.length) return <ProductThumbnail item={item} />;
  return <>
    <button type="button" className="product-photo-button" aria-label={`View ${photos.length} photo${photos.length === 1 ? '' : 's'} of ${name}`} onClick={() => setOpen(true)}>
      <ProductThumbnail item={item} />
      <span>{photos.length > 1 ? `${photos.length} photos` : 'View photo'}</span>
    </button>
    <dialog ref={dialog} className="product-gallery" aria-label={`Photos of ${name}`} onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <header><strong>{name}</strong><button type="button" className="icon-button" aria-label="Close product photos" onClick={() => setOpen(false)}><X size={20} /></button></header>
      <div className="gallery-image">{failed.includes(photos[index]) ? <p>We couldn’t load this photo. Try another image or refresh the order details.</p> : <img src={photos[index]} alt={`${name}, photo ${index + 1}`} referrerPolicy="no-referrer" onError={() => setFailed(x => [...x, photos[index]])} />}</div>
      <footer><button type="button" className="quiet-button" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Previous product photo"><ChevronLeft size={18} /></button><span>{index + 1} of {photos.length}</span><button type="button" className="quiet-button" disabled={index === photos.length - 1} onClick={() => setIndex(index + 1)} aria-label="Next product photo"><ChevronRight size={18} /></button></footer>
    </dialog>
  </>;
}
