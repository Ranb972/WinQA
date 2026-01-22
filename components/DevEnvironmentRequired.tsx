'use client';

import { useState } from 'react';
import { AlertTriangle, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface DevEnvironmentRequiredProps {
  code: string;
}

export default function DevEnvironmentRequired({ code }: DevEnvironmentRequiredProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenCodeSandbox = () => {
    const parameters = {
      files: {
        'index.js': { content: code },
        'package.json': {
          content: JSON.stringify({
            dependencies: { react: 'latest', 'react-dom': 'latest' }
          })
        }
      }
    };

    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(parameters))));
    window.open(`https://codesandbox.io/api/v1/sandboxes/define?parameters=${encoded}`, '_blank');
  };

  const handleOpenCodePen = () => {
    const form = document.createElement('form');
    form.action = 'https://codepen.io/pen/define';
    form.method = 'POST';
    form.target = '_blank';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify({ title: 'Code from WinQA', js: code });

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 p-4 rounded-lg bg-amber-900/20 border border-amber-500/30"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-amber-400" />
        <span className="text-sm font-medium text-amber-400">
          This code requires a full development environment
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        This code uses React, Vue, Node.js, or other frameworks that can&apos;t run in a browser sandbox.
        Open it in an online IDE to test.
      </p>
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={handleOpenCodePen}
          className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
        >
          <ExternalLink className="h-4 w-4 mr-1.5" />
          Open in CodePen
        </Button>
        <Button
          size="sm"
          onClick={handleOpenCodeSandbox}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
        >
          <ExternalLink className="h-4 w-4 mr-1.5" />
          Open in CodeSandbox
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
      </div>
    </motion.div>
  );
}
