import React from 'react';
import { Alert } from '@mui/material';

/** Panelda doim ko'rinadigan chegara izohi (kodda ham shunday: `AdminActivityService`). */
const PrivacyNote: React.FC = () => (
  <Alert severity="info" sx={{ borderRadius: '10px' }}>
    Shaxsiy (1:1) chat va yopiq guruh xabarlarining <b>matni</b> va media <b>mazmuni</b> bu yerda ko'rsatilmaydi — faqat metadata
    (kim, qachon, tur, hajm). Istisno: ochiq kanal media'si va shikoyat qilingan xabar.
  </Alert>
);

export default PrivacyNote;
