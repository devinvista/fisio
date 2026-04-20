import * as React from "react";
import { useRef, useState, useCallback, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
}

interface ISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string };
}

interface ISpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [i: number]: ISpeechRecognitionResult };
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

type VoiceTextareaProps = React.ComponentProps<"textarea">;

const VoiceTextarea = React.forwardRef<HTMLTextAreaElement, VoiceTextareaProps>(
  ({ className, onChange, value, ...props }, ref) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [interim, setInterim] = useState("");
    const recognitionRef = useRef<ISpeechRecognition | null>(null);
    const baseValueRef = useRef<string>("");

    useEffect(() => {
      const API = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      setIsSupported(!!API);
    }, []);

    const fireChange = useCallback(
      (newValue: string) => {
        if (!onChange) return;
        onChange({
          target: { value: newValue } as HTMLTextAreaElement,
          currentTarget: { value: newValue } as HTMLTextAreaElement,
          nativeEvent: new Event("change"),
          bubbles: true,
          cancelable: false,
          defaultPrevented: false,
          eventPhase: 0,
          isTrusted: false,
          preventDefault: () => {},
          isDefaultPrevented: () => false,
          stopPropagation: () => {},
          isPropagationStopped: () => false,
          stopImmediatePropagation: () => {},
          persist: () => {},
          type: "change",
          timeStamp: Date.now(),
        } as React.ChangeEvent<HTMLTextAreaElement>);
      },
      [onChange],
    );

    const stopRecording = useCallback(() => {
      recognitionRef.current?.stop();
    }, []);

    const startRecording = useCallback(() => {
      const API = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!API) return;

      const recognition = new API();
      recognition.lang = "pt-BR";
      recognition.continuous = true;
      recognition.interimResults = true;

      baseValueRef.current = (value as string) ?? "";

      recognition.onstart = () => {
        setIsRecording(true);
        setInterim("");
      };

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        let finalChunk = "";
        let interimChunk = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += text;
          } else {
            interimChunk += text;
          }
        }

        if (finalChunk) {
          const base = baseValueRef.current;
          const separator = base && !base.endsWith(" ") ? " " : "";
          const next = base + separator + finalChunk;
          baseValueRef.current = next;
          setInterim("");
          fireChange(next);
        } else {
          setInterim(interimChunk);
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
        setInterim("");
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterim("");
      };

      recognitionRef.current = recognition;
      recognition.start();
    }, [value, fireChange]);

    const toggle = useCallback(() => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }, [isRecording, startRecording, stopRecording]);

    const displayValue =
      isRecording && interim
        ? ((value as string) ?? "") + (value ? " " : "") + interim
        : value;

    if (!isSupported) {
      return (
        <textarea
          ref={ref}
          className={cn(
            "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
          )}
          onChange={onChange}
          value={value}
          {...props}
        />
      );
    }

    return (
      <div className="relative group/voice">
        <textarea
          ref={ref}
          className={cn(
            "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pr-9",
            isRecording &&
              "border-red-300 bg-red-50/20 focus-visible:ring-red-300",
            className,
          )}
          onChange={onChange}
          value={displayValue}
          readOnly={isRecording}
          {...props}
        />

        <button
          type="button"
          onClick={toggle}
          title={isRecording ? "Parar ditado" : "Ditado por voz (pt-BR)"}
          className={cn(
            "absolute bottom-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded transition-all duration-150",
            isRecording
              ? "bg-red-500 text-white shadow-sm"
              : "text-slate-300 hover:text-slate-500 hover:bg-slate-100 opacity-0 group-hover/voice:opacity-100 focus:opacity-100",
          )}
        >
          {isRecording ? (
            <Square className="h-3 w-3 fill-white" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
        </button>

        {isRecording && (
          <div className="absolute bottom-2 right-9 flex items-center gap-0.5 pointer-events-none">
            <span className="w-0.5 h-3 bg-red-400 rounded-full" style={{ animation: "voice-bar 0.8s ease-in-out infinite" }} />
            <span className="w-0.5 h-3 bg-red-400 rounded-full" style={{ animation: "voice-bar 0.8s ease-in-out 0.15s infinite" }} />
            <span className="w-0.5 h-3 bg-red-400 rounded-full" style={{ animation: "voice-bar 0.8s ease-in-out 0.3s infinite" }} />
            <span className="w-0.5 h-3 bg-red-400 rounded-full" style={{ animation: "voice-bar 0.8s ease-in-out 0.45s infinite" }} />
          </div>
        )}
      </div>
    );
  },
);

VoiceTextarea.displayName = "VoiceTextarea";

export { VoiceTextarea };
