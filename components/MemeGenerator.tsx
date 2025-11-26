import React, { useEffect, useRef, useState } from 'react';

interface MemeGeneratorProps {
  name: string;
  score: number;
  verdict: string;
}

type Template = 'wanted' | 'clown' | 'grave';

export const MemeGenerator: React.FC<MemeGeneratorProps> = ({ name, score, verdict }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [template, setTemplate] = useState<Template>('wanted');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset Canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (template === 'wanted') {
      drawWantedPoster(ctx, name, score);
    } else if (template === 'clown') {
      drawClownLicense(ctx, name, score);
    } else if (template === 'grave') {
      drawTombstone(ctx, name, verdict);
    }

  }, [template, name, score, verdict]);

  const drawWantedPoster = (ctx: CanvasRenderingContext2D, name: string, score: number) => {
    // Paper Background
    ctx.fillStyle = '#f4e4bc';
    ctx.fillRect(10, 10, 380, 480);
    
    // Border
    ctx.strokeStyle = '#4a3b2a';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 360, 460);

    // Text
    ctx.fillStyle = '#4a3b2a';
    ctx.font = '900 60px "Anton", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WANTED', 200, 90);

    ctx.font = 'bold 24px "Courier Prime", monospace';
    ctx.fillText('FOR GHOSTING', 200, 120);

    // Image Placeholder
    ctx.fillStyle = '#222';
    ctx.fillRect(50, 150, 300, 200);
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.fillText('NO IMAGE FOUND', 200, 250);

    // Details
    ctx.fillStyle = '#d00';
    ctx.font = '900 40px "Anton", sans-serif';
    ctx.fillText(name.toUpperCase(), 200, 400);

    ctx.fillStyle = '#000';
    ctx.font = 'bold 20px "Courier Prime", monospace';
    ctx.fillText(`COOKED LEVEL: ${score}%`, 200, 440);
  };

  const drawClownLicense = (ctx: CanvasRenderingContext2D, name: string, score: number) => {
    // Card Background
    ctx.fillStyle = '#fff';
    ctx.fillRect(10, 10, 380, 250);
    
    // Header Bar
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(10, 10, 380, 50);

    // Header Text
    ctx.fillStyle = '#fff';
    ctx.font = '900 30px "Anton", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('OFFICIAL CLOWN', 20, 45);

    // Photo Box
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 80, 100, 120);
    ctx.fillStyle = '#eee';
    ctx.fillRect(20, 80, 100, 120);
    ctx.font = '40px serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText('🤡', 70, 155);

    // Details
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px "Courier Prime", monospace';
    ctx.fillText(`NAME: ${name.toUpperCase()}`, 130, 100);
    ctx.fillText(`OCCUPATION: SIMP`, 130, 130);
    ctx.fillText(`SCORE: ${score}% COOKED`, 130, 160);
    ctx.fillText(`EXP: LIFETIME`, 130, 190);

    // Stamp
    ctx.save();
    ctx.translate(280, 200);
    ctx.rotate(-0.4);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 4;
    ctx.strokeRect(-50, -20, 100, 40);
    ctx.fillStyle = 'red';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CERTIFIED', 0, 8);
    ctx.restore();
  };

  const drawTombstone = (ctx: CanvasRenderingContext2D, name: string, verdict: string) => {
    // Night Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 400, 500);

    // Moon
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(350, 50, 30, 0, Math.PI * 2);
    ctx.fill();

    // Stone
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(200, 150, 100, Math.PI, 0); // Top round
    ctx.lineTo(300, 450);
    ctx.lineTo(100, 450);
    ctx.lineTo(100, 150);
    ctx.fill();

    // Text
    ctx.fillStyle = '#222'; // Engraving
    ctx.font = '900 40px "Anton", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('R.I.P.', 200, 180);

    ctx.font = 'bold 24px "Courier Prime", monospace';
    ctx.fillText(name.toUpperCase(), 200, 240);

    // Verdict split
    const words = verdict.split(' ').slice(0, 4).join(' '); // Limit text
    ctx.font = 'italic 16px "Courier Prime", monospace';
    ctx.fillText(`"${words}..."`, 200, 300);

    ctx.font = 'bold 20px "Courier Prime", monospace';
    ctx.fillText('GHOSTED: 2024', 200, 380);
  };

  const downloadMeme = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `DeadOrGhosting_${template}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="w-full bg-black border-4 border-white p-4 shadow-hard flex flex-col items-center">
      <h3 className="text-hard-gold font-impact text-2xl mb-4 bg-black px-2 uppercase tracking-wide">
        EVIDENCE LOCKER
      </h3>
      
      <div className="flex gap-2 mb-4 w-full">
        <button 
          onClick={() => setTemplate('wanted')}
          className={`flex-1 font-bold py-2 border-2 border-white text-sm md:text-base ${template === 'wanted' ? 'bg-hard-red text-black' : 'text-white'}`}
        >
          WANTED
        </button>
        <button 
          onClick={() => setTemplate('clown')}
          className={`flex-1 font-bold py-2 border-2 border-white text-sm md:text-base ${template === 'clown' ? 'bg-hard-gold text-black' : 'text-white'}`}
        >
          CLOWN
        </button>
        <button 
          onClick={() => setTemplate('grave')}
          className={`flex-1 font-bold py-2 border-2 border-white text-sm md:text-base ${template === 'grave' ? 'bg-hard-concrete text-black' : 'text-white'}`}
        >
          GRAVE
        </button>
      </div>

      <div className="border-2 border-zinc-700 bg-zinc-900 mb-4 overflow-hidden">
        <canvas 
          ref={canvasRef} 
          width={400} 
          height={500} 
          className="max-w-full h-auto"
        />
      </div>

      <button 
        onClick={downloadMeme}
        className="w-full bg-hard-blue text-black font-impact text-xl py-3 border-2 border-black hover:bg-white transition-colors"
      >
        DOWNLOAD EVIDENCE
      </button>
    </div>
  );
};