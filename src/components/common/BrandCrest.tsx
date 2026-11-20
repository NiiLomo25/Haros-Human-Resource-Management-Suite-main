/**
 * Haros HRMIS - Official Republic of Ghana Civil Service Crest Component
 * Shared brand seal rendered across the login portal, workspace chrome,
 * executive dashboard, and official printable documents.
 */

import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import civilServiceCrest from '../../assets/images/civil_service_crest_1794744300577.jpg';

interface BrandCrestProps {
  sizeClass?: string;
  className?: string;
  alt?: string;
  fallbackIconClassName?: string;
}

export const BrandCrest: React.FC<BrandCrestProps> = ({
  sizeClass = 'w-10 h-10',
  className = '',
  alt = 'Ghana Civil Service Official Crest',
  fallbackIconClassName = 'w-5 h-5 text-[#006B3F]',
}) => {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center overflow-hidden shrink-0 ${className}`}
    >
      {!failed ? (
        <img
          src={civilServiceCrest}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <Shield className={fallbackIconClassName} />
      )}
    </div>
  );
};
