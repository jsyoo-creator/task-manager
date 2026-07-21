import { useState, useRef, useEffect } from 'react';
import { ArrowLeftRight, X, Copy, Check, Send, FolderSymlink } from 'lucide-react';
import { convertPath } from '../lib/pathConvert';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  directionLabel?: string;
  note?: string;
  copyable?: boolean;
}

let seq = 0;
const nextId = () => `pcw-${++seq}`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard 권한 없음 — 무시 */ }
      }}
      className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-1 rounded-md text-[#6C63FF] hover:bg-[#6C63FF]/10 transition-colors"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? '복사됨' : '복사'}
    </button>
  );
}

export default function PathConverterWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const handleSubmit = () => {
    const raw = input.trim();
    if (!raw) return;
    const result = convertPath(raw);

    const userMsg: Message = { id: nextId(), role: 'user', text: raw };
    let botMsg: Message;
    if (result.direction === 'none' || !result.output) {
      botMsg = {
        id: nextId(),
        role: 'bot',
        text: '경로 형식을 알아볼 수 없어요. 전체 경로(예: C:\\Users\\... 또는 /Users/...)를 붙여넣어 주세요.',
      };
    } else {
      botMsg = {
        id: nextId(),
        role: 'bot',
        text: result.output,
        directionLabel: result.direction === 'win-to-mac' ? 'Windows → Mac' : 'Mac → Windows',
        note: result.note,
        copyable: true,
      };
    }
    setMessages(prev => [...prev, userMsg, botMsg]);
    setInput('');
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
      {open && (
        <div className="w-[340px] h-[440px] bg-white rounded-2xl shadow-2xl shadow-[#6C63FF]/25 border border-[#EDE9FA] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0" style={{ background: '#1E2264' }}>
            <div className="w-7 h-7 rounded-lg bg-[#6C63FF] flex items-center justify-center flex-shrink-0">
              <FolderSymlink size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-white leading-tight">경로 변환기</p>
              <p className="text-[9.5px] text-white/45 leading-tight">Windows ↔ Mac 자동 변환</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-[#FAFAFE]">
            {messages.length === 0 && (
              <div className="text-center text-[11px] text-gray-400 px-4 pt-6 leading-relaxed">
                윈도우 경로나 맥 경로를 붙여넣으면<br />자동으로 방향을 알아보고 변환해드려요.
                <div className="mt-3 text-[10px] text-gray-300 space-y-0.5">
                  <p>예) C:\Users\홍길동\Desktop\파일.psd</p>
                  <p>예) /Users/hong/Desktop/파일.psd</p>
                </div>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-[11.5px] break-all font-mono leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#6C63FF] text-white rounded-br-sm'
                      : 'bg-white border border-[#EDE9FA] text-gray-700 rounded-bl-sm'
                  }`}
                >
                  {m.directionLabel && (
                    <p className="text-[9px] font-sans font-bold text-[#6C63FF] mb-1 tracking-wide">{m.directionLabel}</p>
                  )}
                  <p>{m.text}</p>
                  {m.note && (
                    <p className="mt-1.5 text-[9.5px] font-sans text-amber-600 leading-snug">⚠ {m.note}</p>
                  )}
                  {m.copyable && (
                    <div className="mt-1.5 flex justify-end">
                      <CopyButton text={m.text} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 p-2.5 border-t border-[#EDE9FA] flex-shrink-0 bg-white">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="경로를 붙여넣으세요"
              className="flex-1 text-[12px] px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-[#6C63FF] transition-colors font-mono"
            />
            <button
              onClick={handleSubmit}
              className="w-8 h-8 rounded-lg bg-[#6C63FF] flex items-center justify-center text-white hover:bg-[#5A52E0] transition-colors flex-shrink-0"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        title="경로 변환기"
        className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl shadow-[#6C63FF]/40 hover:scale-105 active:scale-95 transition-transform flex-shrink-0"
        style={{ background: 'linear-gradient(145deg, #6C63FF 0%, #4B41E0 100%)' }}
      >
        {open ? <X size={20} /> : <ArrowLeftRight size={20} />}
      </button>
    </div>
  );
}
