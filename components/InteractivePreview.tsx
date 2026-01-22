'use client';

import { useState, useRef } from 'react';
import { RefreshCw, Copy, Check, ExternalLink, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface InteractivePreviewProps {
  code: string;
  originalCode?: string;
  isWrapped?: boolean;
}

export default function InteractivePreview({ code, originalCode, isWrapped }: InteractivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    setIsPlaying(true);
    iframeRef.current?.focus();
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleRestart = () => {
    setKey(prev => prev + 1);
    setIsPlaying(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(originalCode || code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenCodePen = () => {
    const codeToUse = originalCode || code;

    const data: { title: string; html: string; css: string; js: string } = {
      title: 'Code from WinQA',
      html: '',
      css: '',
      js: '',
    };

    if (codeToUse.includes('<html') || codeToUse.includes('<body')) {
      const htmlMatch = codeToUse.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const cssMatch = codeToUse.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const jsMatch = codeToUse.match(/<script[^>]*>([\s\S]*?)<\/script>/i);

      if (htmlMatch) {
        let bodyContent = htmlMatch[1];
        bodyContent = bodyContent.replace(/<script[\s\S]*?<\/script>/gi, '');
        bodyContent = bodyContent.replace(/<style[\s\S]*?<\/style>/gi, '');
        data.html = bodyContent.trim();
      }
      data.css = cssMatch ? cssMatch[1].trim() : '';
      data.js = jsMatch ? jsMatch[1].trim() : '';
    } else {
      data.js = codeToUse;
    }

    const form = document.createElement('form');
    form.action = 'https://codepen.io/pen/define';
    form.method = 'POST';
    form.target = '_blank';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify(data);

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3"
    >
      {/* Preview Label */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-medium text-emerald-400">Interactive Preview</span>
        {isWrapped && (
          <span className="text-xs text-slate-500">(JS wrapped in HTML)</span>
        )}
      </div>

      {/* iframe Container */}
      <div className="rounded-lg border border-slate-700 overflow-hidden bg-slate-900" style={{ height: '500px' }}>
        {isPlaying ? (
          <iframe
            key={key}
            ref={iframeRef}
            srcDoc={code}
            sandbox="allow-scripts allow-modals allow-same-origin"
            className="w-full h-full"
            style={{ border: 'none', background: '#1e293b' }}
            title="Code Preview"
          />
        ) : (
          <div
            onClick={handlePlay}
            className="w-full h-full bg-slate-800 flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-slate-700"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-3">
              <Play className="h-8 w-8 text-emerald-400 ml-1" />
            </div>
            <span className="text-lg font-medium text-white">Click to Play</span>
            <span className="text-sm text-slate-400 mt-1">Game will start when you click</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {/* Play/Pause Toggle */}
        {isPlaying ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <Pause className="h-4 w-4 mr-1.5" />
            Pause
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlay}
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Play className="h-4 w-4 mr-1.5" />
            Play
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRestart}
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Restart
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
        >
          {copied ? (
            <Check className="h-4 w-4 mr-1.5 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4 mr-1.5" />
          )}
          {copied ? 'Copied!' : 'Copy Code'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenCodePen}
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
        >
          <ExternalLink className="h-4 w-4 mr-1.5" />
          Open in CodePen
        </Button>
      </div>
    </motion.div>
  );
}
