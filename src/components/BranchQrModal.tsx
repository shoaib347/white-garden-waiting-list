import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, QrCode, X } from 'lucide-react';
import type { Language } from '../data/whiteGardenData';
import type { BranchId, BranchInfo } from '../utils/waitlistLogic';

interface BranchQrModalProps {
  lang: Language;
  branches: BranchInfo[];
  initialBranchId: BranchId;
  allowBranchSwitch: boolean;
  onClose: () => void;
}

const PUBLIC_WAITLIST_BASE_URL = 'https://whitegarden.co/guest-waitlist-form/';

export function BranchQrModal({
  lang,
  branches,
  initialBranchId,
  allowBranchSwitch,
  onClose,
}: BranchQrModalProps) {
  const isAr = lang === 'ar';
  const [activeBranchId, setActiveBranchId] = useState<BranchId>(initialBranchId);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const branch = branches.find((b) => b.id === activeBranchId) ?? branches[0];
  const targetUrl = `${PUBLIC_WAITLIST_BASE_URL}?branch=${branch.id}`;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(targetUrl, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#1B4332',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [targetUrl]);

  const handleDownloadStandeePng = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1650;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background ivory parchment
    ctx.fillStyle = '#F7F9F6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer botanical border frame
    ctx.strokeStyle = '#1B4332';
    ctx.lineWidth = 10;
    ctx.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

    // Inner gold hairline
    ctx.strokeStyle = '#C5A059';
    ctx.lineWidth = 3;
    ctx.strokeRect(68, 68, canvas.width - 136, canvas.height - 136);

    // Top olive header band
    ctx.fillStyle = '#4A6332';
    ctx.fillRect(70, 70, canvas.width - 140, 260);

    // Try drawing the official White Garden SVG logo
    const loadImg = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    try {
      const logoImg = await loadImg('/white-garden-logo.svg');
      const logoH = 175;
      const logoW = (logoImg.width / logoImg.height) * logoH;
      ctx.drawImage(logoImg, (canvas.width - logoW) / 2, 112, logoW, logoH);
    } catch {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 64px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('WHITE GARDEN', canvas.width / 2, 220);
    }

    // Branch Title (EN & AR)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#081C15';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.fillText(branch.nameEn, canvas.width / 2, 425);

    ctx.fillStyle = '#2D6A4F';
    ctx.font = '600 40px sans-serif';
    ctx.fillText(branch.nameAr, canvas.width / 2, 488);

    // QR Code white card container
    const qrBoxSize = 680;
    const qrBoxX = (canvas.width - qrBoxSize) / 2;
    const qrBoxY = 545;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);
    ctx.strokeStyle = '#C5A059';
    ctx.lineWidth = 4;
    ctx.strokeRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

    if (qrDataUrl) {
      const qrImg = await loadImg(qrDataUrl);
      ctx.drawImage(qrImg, qrBoxX + 30, qrBoxY + 30, qrBoxSize - 60, qrBoxSize - 60);
    }

    // Bilingual Call to Action
    ctx.fillStyle = '#081C15';
    ctx.font = 'bold 42px Georgia, serif';
    ctx.fillText('Scan to Join Our Waiting List', canvas.width / 2, 1320);

    ctx.fillStyle = '#1B4332';
    ctx.font = '600 38px sans-serif';
    ctx.fillText('امسح الكود للانضمام لقائمة الانتظار', canvas.width / 2, 1388);

    // Subtitle / URL footer
    ctx.fillStyle = '#556B5D';
    ctx.font = '500 24px sans-serif';
    ctx.fillText(branch.districtEn, canvas.width / 2, 1468);

    ctx.fillStyle = '#8A9A8E';
    ctx.font = '500 22px monospace';
    ctx.fillText(`whitegarden.co/guest-waitlist-form/?branch=${branch.id}`, canvas.width / 2, 1525);

    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `white-garden-waitlist-qr-${branch.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=800,height=950');
    if (!printWin) return;
    printWin.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>White Garden QR — ${branch.nameEn}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; background: #F7F9F6; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 24px; }
    .card { background: #F7F9F6; border: 6px solid #1B4332; outline: 2px solid #C5A059; outline-offset: -14px; width: 520px; text-align: center; padding-bottom: 36px; }
    .top { background: #4A6332; padding: 28px 20px; }
    .top img { height: 76px; width: auto; }
    h1 { color: #081C15; font-size: 30px; margin-top: 24px; }
    h2 { color: #2D6A4F; font-family: sans-serif; font-size: 22px; margin-top: 6px; font-weight: 600; }
    .qr-wrap { background: #fff; border: 2px solid #C5A059; display: inline-block; padding: 16px; margin: 24px auto; border-radius: 14px; }
    .qr-wrap img { width: 280px; height: 280px; display: block; }
    .cta-en { color: #081C15; font-size: 20px; font-weight: bold; }
    .cta-ar { color: #1B4332; font-family: sans-serif; font-size: 19px; font-weight: 600; margin-top: 8px; direction: rtl; }
    .addr { color: #556B5D; font-family: sans-serif; font-size: 12px; margin-top: 16px; padding: 0 24px; }
    @media print { body { background: #fff; padding: 0; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="top"><img src="${window.location.origin}/white-garden-logo.svg" alt="White Garden" /></div>
    <h1>${branch.nameEn}</h1>
    <h2>${branch.nameAr}</h2>
    <div class="qr-wrap"><img src="${qrDataUrl}" alt="QR Code" /></div>
    <p class="cta-en">Scan to Join Our Waiting List</p>
    <p class="cta-ar">امسح الكود للانضمام لقائمة الانتظار</p>
    <p class="addr">${branch.districtEn}</p>
  </div>
  <script>window.onload = function() { setTimeout(function(){ window.print(); }, 250); };</script>
</body>
</html>`);
    printWin.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#081C15]/55 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-qr-title"
        className="bg-white border border-[#1B4332]/20 rounded-2xl w-full max-w-md shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Top Modal Header */}
        <div className="bg-[#081C15] text-white px-5 py-4 border-b border-[#C5A059]/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#C5A059]" aria-hidden="true" />
            <h2 id="branch-qr-title" className="font-display text-xl font-semibold">
              {isAr ? 'رمز QR لقائمة انتظار الفرع' : 'Walk-in Waitlist QR Code'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close QR modal"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {allowBranchSwitch && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setActiveBranchId(b.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    b.id === activeBranchId
                      ? 'bg-[#1B4332] text-white border-[#1B4332]'
                      : 'bg-[#F7F9F6] text-[#081C15] border-[#1B4332]/15 hover:border-[#1B4332]/40'
                  }`}
                >
                  {isAr ? b.nameAr : b.nameEn}
                </button>
              ))}
            </div>
          )}

          {/* Printable Standee Preview Card */}
          <div className="rounded-2xl border-2 border-[#1B4332] bg-[#F7F9F6] overflow-hidden text-center shadow-xs">
            <div className="bg-[#4A6332] py-4 px-4 flex justify-center">
              <img
                src="/white-garden-logo.svg"
                alt="White Garden"
                className="h-11 w-auto"
              />
            </div>

            <div className="p-5 space-y-3">
              <div>
                <p className="font-display text-2xl font-semibold text-[#081C15]">
                  {branch.nameEn}
                </p>
                <p className="text-sm font-semibold text-[#2D6A4F]">{branch.nameAr}</p>
              </div>

              <div className="inline-block p-3 bg-white rounded-2xl border border-[#C5A059]/60 shadow-xs">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${branch.nameEn} waitlist`}
                    className="w-48 h-48 block"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-[#081C15]/50">
                    Generating QR...
                  </div>
                )}
              </div>

              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-[#081C15]">
                  Scan to Join Our Waiting List
                </p>
                <p className="text-sm font-semibold text-[#1B4332]" dir="rtl">
                  امسح الكود للانضمام لقائمة الانتظار
                </p>
              </div>

              <p className="text-[11px] font-mono text-[#081C15]/55 break-all" dir="ltr">
                {targetUrl}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleDownloadStandeePng}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#081C15] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
              <span>{isAr ? 'تحميل PNG للطباعة' : 'Download Standee PNG'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#1B4332]/25 bg-white hover:bg-[#F7F9F6] text-[#1B4332] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
              <span>{isAr ? 'طباعة' : 'Print Standee'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
