/**
 * Haros HRMIS - Reactive Institution Branding Hook
 * Subscribes to System Configuration updates so institution name & country
 * sync immediately across TitleBar, LoginPage, Sidebar, Reports, and Official Documents.
 */

import { useState, useEffect } from 'react';
import { db } from '../db/storage';

const DEFAULT_INSTITUTION_NAME = 'Office of the Head of Civil Service';
const DEFAULT_INSTITUTION_COUNTRY = 'Republic of Ghana';

function readInstitutionInfo() {
  const rawName = db.getSettingValue('INSTITUTION_NAME', DEFAULT_INSTITUTION_NAME);
  const rawCountry = db.getSettingValue('INSTITUTION_COUNTRY', DEFAULT_INSTITUTION_COUNTRY);
  return {
    institutionName: rawName.trim() || DEFAULT_INSTITUTION_NAME,
    institutionCountry: rawCountry.trim() || DEFAULT_INSTITUTION_COUNTRY,
  };
}

export function useInstitutionInfo() {
  const [info, setInfo] = useState(readInstitutionInfo);

  useEffect(() => {
    const sync = () => setInfo(readInstitutionInfo());
    window.addEventListener('haros:settings-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('haros:settings-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return info;
}
