import { useEffect, useRef } from 'react';
import { sanitizeRichText } from '../lib/sanitizeRichText';

export default function RichTextEditor({ initialValue, onChange, placeholder, className }: {
  initialValue: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // 최초 마운트 시 한 번만 초기값 주입 — 이후 입력 중 innerHTML을 외부에서 되돌리면
  // 커서 위치가 튀므로 리렌더 시 재주입하지 않는다 (다른 폼과 동일하게 사실상 비제어 입력)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialValue;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const toInsert = html ? sanitizeRichText(html) : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    document.execCommand('insertHTML', false, toInsert);
    onChange(ref.current?.innerHTML ?? '');
  };

  return (
    <div
      ref={ref}
      contentEditable
      onPaste={handlePaste}
      onInput={() => onChange(ref.current?.innerHTML ?? '')}
      data-placeholder={placeholder}
      className={`ai-tool-rich rich-text-editor ${className ?? ''}`}
      suppressContentEditableWarning
    />
  );
}
