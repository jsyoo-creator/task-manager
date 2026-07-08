import { useEffect, useRef } from 'react';
import { Image as ImageIcon } from 'lucide-react';
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

  // 외부(노션·챗봇 등)에서 복사한 미리보기 이미지는 대부분 SVG·캔버스라 붙여넣기로 옮겨오지
  // 못한다 — 직접 이미지 URL을 넣을 수 있는 수동 삽입 버튼을 제공
  const handleInsertImage = () => {
    const url = window.prompt('삽입할 이미지 URL을 입력하세요');
    if (!url?.trim()) return;
    ref.current?.focus();
    const safeUrl = url.trim().replace(/"/g, '&quot;');
    document.execCommand('insertHTML', false, sanitizeRichText(`<img src="${safeUrl}">`));
    onChange(ref.current?.innerHTML ?? '');
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={handleInsertImage}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <ImageIcon size={12} />이미지 삽입
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        onPaste={handlePaste}
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        data-placeholder={placeholder}
        className={`ai-tool-rich rich-text-editor ${className ?? ''}`}
        suppressContentEditableWarning
      />
    </div>
  );
}
