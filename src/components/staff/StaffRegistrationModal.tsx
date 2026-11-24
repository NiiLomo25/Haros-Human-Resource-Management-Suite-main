/**
 * Haros HRMIS - Complete Civil Service Employee Registration Modal
 * Captures Personal Details, Employment Placement, and Initial Qualifications.
 */

import React, { useState } from 'react';
import {
  UserPlus,
  X,
  User,
  Briefcase,
  GraduationCap,
  Calendar,
  Building2,
  AlertCircle,
  CheckCircle2,
  Shield,
  Zap,
  Sparkles,
  Award,
  Plus,
  Trash2,
} from 'lucide-react';
import { db } from '../../db/storage';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  Gender,
  MaritalStatus,
  EmployeeCategory,
  EmploymentType,
  EmploymentStatus,
  SkillCategory,
} from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';
import { SlideOverPanel } from '../common/SlideOverPanel';
import { TrainingAndSkillsEditor, SkillEntry } from './TrainingAndSkillsEditor';

interface MembershipEntry {
  id?: number;
  professionalBody: string;
  membershipNumber: string;
  membershipCategory: string;
  registrationDate: string;
  expiryDate: string;
  membershipStatus: 'Active' | 'Lapsed' | 'Suspended';
}

interface StaffRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistered: (staffId: string) => void;
  employeeId?: number | null;
  initialTab?: 'personal' | 'employment' | 'qualification' | 'skills';
}

export const StaffRegistrationModal: React.FC<StaffRegistrationModalProps> = ({
  isOpen,
  onClose,
  onRegistered,
  employeeId = null,
  initialTab = 'personal',
}) => {
  const { currentUser } = useAuth();
  const notifications = useNotifications();
  const mdas = db.getMdas();
  const departments = db.getDepartments();
  const gradeLevels = db.getGradeLevels();

  const isEditMode = Boolean(employeeId);
  const [activeTab, setActiveTab] = useState<'personal' | 'employment' | 'qualification' | 'skills'>(initialTab);
  const [errorMessage, setErrorMessage] = useState('');

  // Form State - Personal
  const [staffId, setStaffId] = useState(`EMP-${Math.floor(10000 + Math.random() * 90000)}`);
  const [surname, setSurname] = useState('');
  const [firstName, setFirstName] = useState('');
  const [otherNames, setOtherNames] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('1988-06-15');
  const [gender, setGender] = useState<Gender>('Male');
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus>('Married');
  const [nationality, setNationality] = useState('Ghanaian');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [nationalIdentificationNumber, setNationalIdentificationNumber] = useState('');
  const [telephoneNumber, setTelephoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [nextOfKinName, setNextOfKinName] = useState('');
  const [nextOfKinRelationship, setNextOfKinRelationship] = useState('Spouse');
  const [nextOfKinPhone, setNextOfKinPhone] = useState('');
  const [otherContacts, setOtherContacts] = useState<string[]>([]);

  // Form State - Employment
  const [employeeCategory, setEmployeeCategory] = useState<EmployeeCategory>('Professional');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('Permanent & Pensionable');
  const [dateOfFirstAppointment, setDateOfFirstAppointment] = useState('2022-01-10');
  const [dateOfAssumptionOfDuty, setDateOfAssumptionOfDuty] = useState('2022-01-10');
  const [currentMdaId, setCurrentMdaId] = useState<number>(mdas[0]?.id || 1);
  const [currentDepartmentId, setCurrentDepartmentId] = useState<number>(departments[0]?.id || 1);
  const [currentPositionTitle, setCurrentPositionTitle] = useState('');
  const [currentGradeId, setCurrentGradeId] = useState<number>(gradeLevels[4]?.id || 5); // L14 default
  const [currentSalaryLevel, setCurrentSalaryLevel] = useState<number>(14);
  const [currentSalaryStep, setCurrentSalaryStep] = useState<number>(1);
  const [firstGradeId, setFirstGradeId] = useState<number | ''>('');
  const [currentPromotionDate, setCurrentPromotionDate] = useState('');
  const [previousPosting, setPreviousPosting] = useState('');
  const [dateAssignedCurrentGrade, setDateAssignedCurrentGrade] = useState('');

  // Form State - Initial Qualification & Professional Memberships
  const [qualLevel, setQualLevel] = useState('Bachelor');
  const [qualTitle, setQualTitle] = useState('');
  const [qualInstitution, setQualInstitution] = useState('');
  const [qualCourse, setQualCourse] = useState('');
  const [qualYear, setQualYear] = useState<number>(2018);
  const [memberships, setMemberships] = useState<MembershipEntry[]>([]);

  // Form State - Training Capabilities & Staff Skills (Step 4)
  const [capabilities, setCapabilities] = useState<string[]>(['']);
  const [skills, setSkills] = useState<SkillEntry[]>([]);

  // Load existing employee data in Edit Mode
  React.useEffect(() => {
    if (!isOpen) return;
    if (employeeId) {
      const emp = db.getEmployeeById(employeeId);
      const personal = db.getEmployeePersonalInfo(employeeId);
      const employment = db.getEmployeeEmploymentInfo(employeeId);
      const quals = db.getEmployeeQualifications(employeeId);
      const mems = db.getEmployeeMemberships(employeeId);
      const caps = db.getTrainingCapabilities(employeeId);
      const sks = db.getEmployeeSkills(employeeId);

      if (emp) setStaffId(emp.staffId);
      if (personal) {
        setSurname(personal.surname || '');
        setFirstName(personal.firstName || '');
        setOtherNames(personal.otherNames || '');
        setDateOfBirth(personal.dateOfBirth || '1988-06-15');
        setGender(personal.gender || 'Male');
        setMaritalStatus(personal.maritalStatus || 'Married');
        setNationality(personal.nationality || 'Ghanaian');
        setResidentialAddress(personal.residentialAddress || '');
        setNationalIdentificationNumber(personal.nationalIdentificationNumber || '');
        setTelephoneNumber(personal.telephoneNumber || '');
        setEmailAddress(personal.emailAddress || '');
        setEmergencyContactName(personal.emergencyContactName || '');
        setEmergencyContactPhone(personal.emergencyContactPhone || '');
        setNextOfKinName(personal.nextOfKinName || '');
        setNextOfKinRelationship(personal.nextOfKinRelationship || 'Spouse');
        setNextOfKinPhone(personal.nextOfKinPhone || '');
        setOtherContacts(personal.otherContacts ? [...personal.otherContacts] : []);
      }

      if (employment) {
        setEmployeeCategory(employment.employeeCategory || 'Professional');
        setEmploymentType(employment.employmentType || 'Permanent & Pensionable');
        setDateOfFirstAppointment(employment.dateOfFirstAppointment || '2022-01-10');
        setDateOfAssumptionOfDuty(employment.dateOfAssumptionOfDuty || '2022-01-10');
        setCurrentMdaId(employment.currentMdaId || 1);
        setCurrentDepartmentId(employment.currentDepartmentId || 1);
        setCurrentPositionTitle(employment.currentPositionTitle || '');
        setCurrentGradeId(employment.currentGradeId || 5);
        setCurrentSalaryLevel(employment.currentSalaryLevel || 14);
        setCurrentSalaryStep(employment.currentSalaryStep || 1);
        setFirstGradeId(employment.firstGradeId ?? '');
        setCurrentPromotionDate(employment.currentPromotionDate || '');
        setPreviousPosting(employment.previousPosting || '');
        setDateAssignedCurrentGrade(employment.dateAssignedCurrentGrade || '');
      }

      if (quals && quals.length > 0) {
        const primaryQual = quals[0];
        setQualLevel(primaryQual.qualificationLevel || 'Bachelor');
        setQualTitle(primaryQual.qualificationTitle || '');
        setQualInstitution(primaryQual.institutionName || '');
        setQualCourse(primaryQual.courseOfStudy || '');
        setQualYear(primaryQual.yearObtained || 2018);
      }

      if (mems && mems.length > 0) {
        setMemberships(
          mems.map((m) => ({
            id: m.id,
            professionalBody: m.professionalBody || '',
            membershipNumber: m.membershipNumber || '',
            membershipCategory: m.membershipCategory || 'Full Member',
            registrationDate: m.registrationDate || new Date().toISOString().split('T')[0],
            expiryDate: m.expiryDate || '',
            membershipStatus: m.membershipStatus || 'Active',
          }))
        );
      } else {
        setMemberships([]);
      }

      if (caps && caps.length > 0) {
        setCapabilities(caps.map((c) => c.capability));
      } else {
        setCapabilities(['']);
      }

      if (sks && sks.length > 0) {
        setSkills(
          sks.map((s) => ({
            id: s.id,
            skillName: s.skillName,
            category: s.category,
            evidence: s.evidence || '',
          }))
        );
      } else {
        setSkills([]);
      }
      setActiveTab(initialTab);
    } else {
      // Reset for Create Mode
      setStaffId(`EMP-${Math.floor(10000 + Math.random() * 90000)}`);
      setSurname('');
      setFirstName('');
      setOtherNames('');
      setDateOfBirth('1988-06-15');
      setGender('Male');
      setMaritalStatus('Married');
      setNationality('Ghanaian');
      setResidentialAddress('');
      setNationalIdentificationNumber('');
      setTelephoneNumber('');
      setEmailAddress('');
      setEmergencyContactName('');
      setEmergencyContactPhone('');
      setNextOfKinName('');
      setNextOfKinRelationship('Spouse');
      setNextOfKinPhone('');
      setOtherContacts([]);
      setEmployeeCategory('Professional');
      setEmploymentType('Permanent & Pensionable');
      setDateOfFirstAppointment('2022-01-10');
      setDateOfAssumptionOfDuty('2022-01-10');
      setCurrentMdaId(mdas[0]?.id || 1);
      setCurrentDepartmentId(departments[0]?.id || 1);
      setCurrentPositionTitle('');
      setCurrentGradeId(gradeLevels[4]?.id || 5);
      setCurrentSalaryLevel(14);
      setCurrentSalaryStep(1);
      setFirstGradeId('');
      setCurrentPromotionDate('');
      setPreviousPosting('');
      setDateAssignedCurrentGrade('');
      setQualLevel('Bachelor');
      setQualTitle('');
      setQualInstitution('');
      setQualCourse('');
      setQualYear(2018);
      setMemberships([]);
      setCapabilities(['']);
      setSkills([]);
      setActiveTab('personal');
    }
    setErrorMessage('');
  }, [isOpen, employeeId, initialTab]);

  // Filtered Departments for selected MDA
  const filteredDepts = departments.filter((d) => d.mdaId === Number(currentMdaId));

  // Dynamic computations
  const calculatedAge = dateOfBirth ? db.calculateAge(dateOfBirth) : 0;
  const dobDate = new Date(dateOfBirth);
  const apptDate = new Date(dateOfFirstAppointment);
  const retByAge = new Date(dobDate);
  retByAge.setFullYear(retByAge.getFullYear() + 60);
  const retByService = new Date(apptDate);
  retByService.setFullYear(retByService.getFullYear() + 35);
  const estimatedRetDate = (retByAge < retByService ? retByAge : retByService).toISOString().split('T')[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Validations
    const failValidation = (msg: string, tab?: 'personal' | 'employment' | 'qualification' | 'skills') => {
      setErrorMessage(msg);
      if (tab) setActiveTab(tab);
      notifications.warning('Validation Warning', msg, {
        module: 'Staff Registration',
        actor: currentUser?.username,
      });
    };

    if (!staffId.trim()) {
      failValidation('Staff ID is required.');
      return;
    }
    if (!surname.trim() || !firstName.trim()) {
      failValidation('Surname and First Name are mandatory civil service fields.');
      return;
    }
    if (!currentPositionTitle.trim()) {
      failValidation('Position / Role Title is required.');
      return;
    }
    if (calculatedAge < 18 || calculatedAge > 65) {
      failValidation('Employee age must be between 18 and 65 years.');
      return;
    }
    if (currentPromotionDate) {
      const promoDate = new Date(currentPromotionDate);
      if (isNaN(promoDate.getTime())) {
        failValidation('Current Promotion Date must be a valid date.', 'employment');
        return;
      }
      if (promoDate > new Date()) {
        failValidation('Current Promotion Date cannot be in the future.', 'employment');
        return;
      }
      if (dateOfFirstAppointment && promoDate < new Date(dateOfFirstAppointment)) {
        failValidation('Current Promotion Date cannot be earlier than First Appointment.', 'employment');
        return;
      }
    }

    // Validate and clean Professional Memberships
    const validMemberships: {
      professionalBody: string;
      membershipNumber: string;
      membershipCategory: string;
      registrationDate: string;
      expiryDate?: string;
      membershipStatus: 'Active' | 'Lapsed' | 'Suspended';
    }[] = [];
    const seenMembershipKeys = new Set<string>();
    const todayIso = new Date().toISOString().split('T')[0];

    for (let i = 0; i < memberships.length; i++) {
      const m = memberships[i];
      const trimmedBody = m.professionalBody.trim();
      const trimmedNum = m.membershipNumber.trim();
      const trimmedExpiry = m.expiryDate.trim();
      const hasContent = trimmedBody.length > 0 || trimmedNum.length > 0 || trimmedExpiry.length > 0;

      if (!hasContent) continue;

      if (!trimmedBody || !trimmedNum) {
        failValidation(
          'Professional Body and Membership Number are required for each professional membership entry.',
          'qualification'
        );
        return;
      }

      const regDate = m.registrationDate.trim() || todayIso;
      if (trimmedExpiry && trimmedExpiry < regDate) {
        failValidation(
          `Membership expiry date cannot precede registration date (${trimmedBody}).`,
          'qualification'
        );
        return;
      }

      const key = `${trimmedBody.toLowerCase()}::${trimmedNum.toLowerCase()}`;
      if (seenMembershipKeys.has(key)) {
        failValidation(
          `Duplicate professional membership detected: "${trimmedBody} (${trimmedNum})".`,
          'qualification'
        );
        return;
      }
      seenMembershipKeys.add(key);

      validMemberships.push({
        professionalBody: trimmedBody,
        membershipNumber: trimmedNum,
        membershipCategory: m.membershipCategory.trim() || 'Full Member',
        registrationDate: regDate,
        expiryDate: trimmedExpiry || undefined,
        membershipStatus: m.membershipStatus || 'Active',
      });

      if (validMemberships.length >= 10) break;
    }

    // Clean Other Contact numbers: trim, drop blanks, deduplicate
    const cleanOtherContacts = Array.from(
      new Set(otherContacts.map((c) => c.trim()).filter((c) => c.length > 0))
    );

    // Clean capabilities: ignore completely blank entries
    const nonBlankCaps = capabilities
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
      .slice(0, 10);

    // Validate and clean skills
    const validSkills: { skillName: string; category: SkillCategory; evidence: string }[] = [];
    const seenSkillNames = new Set<string>();

    for (let i = 0; i < skills.length; i++) {
      const s = skills[i];
      const trimmedName = s.skillName.trim();
      const trimmedEvidence = s.evidence.trim();
      const hasContent = trimmedName.length > 0 || trimmedEvidence.length > 0;

      if (!hasContent) {
        // completely empty entry, ignore
        continue;
      }

      if (!trimmedName || !s.category) {
        failValidation('Skill / Competency and Category are required for each skill entry.', 'skills');
        return;
      }

      const lowerName = trimmedName.toLowerCase();
      if (seenSkillNames.has(lowerName)) {
        failValidation(`Duplicate skill detected: "${trimmedName}" has already been entered.`, 'skills');
        return;
      }
      seenSkillNames.add(lowerName);

      validSkills.push({
        skillName: trimmedName,
        category: s.category as SkillCategory,
        evidence: trimmedEvidence,
      });

      if (validSkills.length >= 10) break;
    }

    try {
      if (isEditMode && employeeId) {
        // Edit Mode: update existing employee
        db.updateEmployee(
          employeeId,
          {
            personal: {
              surname: surname.trim(),
              firstName: firstName.trim(),
              otherNames: otherNames.trim() || undefined,
              dateOfBirth,
              gender,
              maritalStatus,
              nationality,
              nationalIdentificationNumber: nationalIdentificationNumber.trim().toUpperCase() || undefined,
              residentialAddress: residentialAddress.trim() || 'Accra, Greater Accra',
              telephoneNumber: telephoneNumber.trim() || '+233 24 000 0000',
              emailAddress: emailAddress.trim() || `${firstName.toLowerCase()}.${surname.toLowerCase()}@civilservice.gov.gh`,
              emergencyContactName: emergencyContactName.trim() || nextOfKinName || 'Family Member',
              emergencyContactPhone: emergencyContactPhone.trim() || telephoneNumber || '+233 20 000 0000',
              nextOfKinName: nextOfKinName.trim() || 'Not specified',
              nextOfKinRelationship,
              nextOfKinPhone: nextOfKinPhone.trim() || telephoneNumber || '+233 20 000 0000',
              otherContacts: cleanOtherContacts.length > 0 ? cleanOtherContacts : undefined,
            },
            employment: {
              employeeCategory,
              employmentType,
              dateOfFirstAppointment,
              dateOfAssumptionOfDuty,
              currentEmploymentStatus: 'Active' as EmploymentStatus,
              currentMdaId: Number(currentMdaId),
              currentDepartmentId: Number(currentDepartmentId),
              currentPositionTitle: currentPositionTitle.trim(),
              currentGradeId: Number(currentGradeId),
              currentSalaryLevel: Number(currentSalaryLevel),
              currentSalaryStep: Number(currentSalaryStep),
              dateAssignedCurrentRole: dateOfAssumptionOfDuty,
              dateAssignedCurrentGrade: isEditMode
                ? dateAssignedCurrentGrade || dateOfFirstAppointment
                : currentPromotionDate || dateOfFirstAppointment,
              firstGradeId: firstGradeId === '' ? undefined : Number(firstGradeId),
              currentPromotionDate: currentPromotionDate || undefined,
              previousPosting: previousPosting.trim() || undefined,
            },
            memberships: validMemberships,
            trainingCapabilities: nonBlankCaps,
            skills: validSkills,
          },
          currentUser?.username || 'admin'
        );

        // Update qualification if provided
        if (qualTitle.trim()) {
          const existingQuals = db.getEmployeeQualifications(employeeId);
          if (existingQuals.length === 0) {
            db.addQualification(
              {
                employeeId,
                qualificationLevel: qualLevel,
                qualificationTitle: qualTitle.trim(),
                institutionName: qualInstitution.trim() || 'Accredited Institution',
                country: 'Ghana',
                courseOfStudy: qualCourse.trim() || qualTitle.trim(),
                yearObtained: Number(qualYear),
                verificationStatus: 'Verified',
              },
              currentUser?.username || 'admin'
            );
          }
        }

        onRegistered(staffId.trim().toUpperCase());
        onClose();
      } else {
        // Create Mode: register new employee
        db.createEmployee(
          {
            staffId: staffId.trim(),
            personal: {
              surname: surname.trim(),
              firstName: firstName.trim(),
              otherNames: otherNames.trim() || undefined,
              dateOfBirth,
              gender,
              maritalStatus,
              nationality,
              nationalIdentificationNumber: nationalIdentificationNumber.trim().toUpperCase() || undefined,
              residentialAddress: residentialAddress.trim() || 'Accra, Greater Accra',
              telephoneNumber: telephoneNumber.trim() || '+233 24 000 0000',
              emailAddress: emailAddress.trim() || `${firstName.toLowerCase()}.${surname.toLowerCase()}@civilservice.gov.gh`,
              emergencyContactName: emergencyContactName.trim() || nextOfKinName || 'Family Member',
              emergencyContactPhone: emergencyContactPhone.trim() || telephoneNumber || '+233 20 000 0000',
              nextOfKinName: nextOfKinName.trim() || 'Not specified',
              nextOfKinRelationship,
              nextOfKinPhone: nextOfKinPhone.trim() || telephoneNumber || '+233 20 000 0000',
              otherContacts: cleanOtherContacts.length > 0 ? cleanOtherContacts : undefined,
            },
            employment: {
              employeeCategory,
              employmentType,
              dateOfFirstAppointment,
              dateOfAssumptionOfDuty,
              currentEmploymentStatus: 'Active' as EmploymentStatus,
              currentMdaId: Number(currentMdaId),
              currentDepartmentId: Number(currentDepartmentId),
              currentPositionTitle: currentPositionTitle.trim(),
              currentGradeId: Number(currentGradeId),
              currentSalaryLevel: Number(currentSalaryLevel),
              currentSalaryStep: Number(currentSalaryStep),
              dateAssignedCurrentRole: dateOfAssumptionOfDuty,
              dateAssignedCurrentGrade: isEditMode
                ? dateAssignedCurrentGrade || dateOfFirstAppointment
                : currentPromotionDate || dateOfFirstAppointment,
              firstGradeId: firstGradeId === '' ? undefined : Number(firstGradeId),
              currentPromotionDate: currentPromotionDate || undefined,
              previousPosting: previousPosting.trim() || undefined,
            },
            initialQualification: qualTitle.trim()
              ? {
                  qualificationLevel: qualLevel,
                  qualificationTitle: qualTitle.trim(),
                  institutionName: qualInstitution.trim() || 'Accredited Institution',
                  country: 'Ghana',
                  courseOfStudy: qualCourse.trim() || qualTitle.trim(),
                  yearObtained: Number(qualYear),
                  verificationStatus: 'Verified',
                }
              : undefined,
            memberships: validMemberships,
            trainingCapabilities: nonBlankCaps,
            skills: validSkills,
          },
          currentUser?.username || 'admin'
        );

        onRegistered(staffId.trim().toUpperCase());
        onClose();
      }
    } catch (err: any) {
      const msg = err.message || 'Error saving employee record.';
      setErrorMessage(msg);
      notifications.error('Staff Save Failed', msg, {
        module: 'Staff Registration',
        actor: currentUser?.username,
      });
    }
  };

  return (
    <SlideOverPanel
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Employee Record' : 'Register New Civil Service Employee'}
      subtitle="Central Employee Database • Permanent Historical Record"
      icon={isEditMode ? <Sparkles className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
      maxWidthClass="max-w-3xl lg:max-w-4xl"
      overlayClassName="bg-black/40"
    >
      {/* Wizard Step Tabs */}
          <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`py-2.5 px-4 flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'personal'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>1. Personal & Next-of-Kin</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('employment')}
            className={`py-2.5 px-4 flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'employment'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>2. Placement & Grade Cadre</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qualification')}
            className={`py-2.5 px-4 flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'qualification'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>3. Qualifications &amp; Memberships</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('skills')}
            className={`py-2.5 px-4 flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'skills'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>4. Training & Skills</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="m-3 p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2 text-xs shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'personal' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                <div>
                  <span className="font-bold">Unique Staff Identification:</span>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    This Staff ID is globally unique and permanently anchors all historical movement records.
                  </p>
                </div>
                <div className="w-48">
                  <label className="block text-[10px] uppercase font-bold text-blue-900">Staff ID</label>
                  <input
                    type="text"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    className="w-full h-8 px-2 rounded border border-blue-300 font-mono font-bold text-slate-900 uppercase focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                    placeholder="e.g. OHCS-EMP-00109"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Surname (Family Name) *</label>
                  <input
                    type="text"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                    placeholder="e.g. Mensah"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">First Name *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                    placeholder="e.g. Kwame"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Other Names</label>
                  <input
                    type="text"
                    value={otherNames}
                    onChange={(e) => setOtherNames(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                    placeholder="e.g. Atta"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono"
                    required
                  />
                  <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
                    Age: {calculatedAge} years
                  </span>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Gender *</label>
                  <SearchableSelect
                    value={gender}
                    onChange={(val) => setGender(val as Gender)}
                    options={[
                      { value: 'Male', label: 'Male' },
                      { value: 'Female', label: 'Female' },
                    ]}
                    placeholder="Select gender..."
                    searchPlaceholder="Filter gender..."
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Marital Status</label>
                  <SearchableSelect
                    value={maritalStatus}
                    onChange={(val) => setMaritalStatus(val as MaritalStatus)}
                    options={[
                      { value: 'Single', label: 'Single' },
                      { value: 'Married', label: 'Married' },
                      { value: 'Divorced', label: 'Divorced' },
                      { value: 'Widowed', label: 'Widowed' },
                      { value: 'Separated', label: 'Separated' },
                    ]}
                    placeholder="Select marital status..."
                    searchPlaceholder="Filter status..."
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Nationality</label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Ghana Card (NIA)</label>
                  <input
                    type="text"
                    value={nationalIdentificationNumber}
                    onChange={(e) => setNationalIdentificationNumber(e.target.value.toUpperCase())}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono uppercase"
                    placeholder="e.g. GHA-718293041-9"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Telephone Number *</label>
                  <input
                    type="text"
                    value={telephoneNumber}
                    onChange={(e) => setTelephoneNumber(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono"
                    placeholder="+233 24 000 0000"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                    placeholder="officer@civilservice.gov.gh"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Residential Address</label>
                <input
                  type="text"
                  value={residentialAddress}
                  onChange={(e) => setResidentialAddress(e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                  placeholder="e.g. House No. 24, Cantonments, Accra"
                />
              </div>

              {/* Next of Kin & Emergency */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Next of Kin & Emergency Details:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Next of Kin Full Name</label>
                    <input
                      type="text"
                      value={nextOfKinName}
                      onChange={(e) => setNextOfKinName(e.target.value)}
                      className="w-full h-8 px-2 rounded border border-slate-300 bg-white"
                      placeholder="e.g. Evelyn Mensah"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Relationship</label>
                    <input
                      type="text"
                      value={nextOfKinRelationship}
                      onChange={(e) => setNextOfKinRelationship(e.target.value)}
                      className="w-full h-8 px-2 rounded border border-slate-300 bg-white"
                      placeholder="e.g. Spouse / Mother / Sibling"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Next of Kin Phone</label>
                    <input
                      type="text"
                      value={nextOfKinPhone}
                      onChange={(e) => setNextOfKinPhone(e.target.value)}
                      className="w-full h-8 px-2 rounded border border-slate-300 bg-white font-mono"
                      placeholder="+233 20 000 0000"
                    />
                  </div>
                </div>
              </div>

              {/* Other Contact Numbers */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Other Contact Number(s) (Optional)
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtherContacts((prev) => [...prev, ''])}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-semibold transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Contact</span>
                  </button>
                </div>
                {otherContacts.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">
                    No additional contact numbers. Click <strong>+ Add Contact</strong> to capture secondary phone numbers.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {otherContacts.map((contact, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={contact}
                          onChange={(e) =>
                            setOtherContacts((prev) =>
                              prev.map((c, i) => (i === idx ? e.target.value : c))
                            )
                          }
                          className="flex-1 h-8 px-2 rounded border border-slate-300 bg-white font-mono text-xs"
                          placeholder="+233 55 000 0000"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setOtherContacts((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-1.5 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors"
                          title="Remove contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'employment' && (
            <div className="space-y-4">
              {/* Category & Cadre */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg">
                <div className="font-bold text-indigo-950 text-xs mb-1">
                  Civil Service Cadre Classification:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-indigo-900 font-semibold mb-1">
                      Staff Categorization *
                    </label>
                    <SearchableSelect
                      value={employeeCategory}
                      onChange={(val) => setEmployeeCategory(val as EmployeeCategory)}
                      options={[
                        { value: 'Professional', label: 'Professional Cadre', badge: 'Tier 1' },
                        { value: 'Sub-Professional', label: 'Sub-Professional Cadre', badge: 'Tier 2' },
                        { value: 'Technical', label: 'Technical Cadre' },
                        { value: 'Administrative', label: 'Administrative Cadre' },
                      ]}
                      placeholder="Select staff categorization..."
                      searchPlaceholder="Filter cadre categorization..."
                    />
                  </div>

                  <div>
                    <label className="block text-indigo-900 font-semibold mb-1">
                      Employment Type
                    </label>
                    <SearchableSelect
                      value={employmentType}
                      onChange={(val) => setEmploymentType(val as EmploymentType)}
                      options={[
                        { value: 'Permanent & Pensionable', label: 'Permanent & Pensionable' },
                        { value: 'Fixed-Term Contract', label: 'Fixed-Term Contract' },
                        { value: 'Casual', label: 'Casual' },
                      ]}
                      placeholder="Select employment type..."
                      searchPlaceholder="Filter employment types..."
                    />
                  </div>
                </div>
              </div>

              {/* Ministry & Department Placement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Current Ministry / Agency (MDA) *
                  </label>
                  <SearchableSelect
                    value={currentMdaId}
                    onChange={(val) => {
                      const mdaId = Number(val);
                      setCurrentMdaId(mdaId);
                      const depts = departments.filter((d) => d.mdaId === mdaId);
                      if (depts.length > 0) setCurrentDepartmentId(depts[0].id);
                    }}
                    options={mdas.map((m) => ({
                      value: m.id.toString(),
                      label: `${m.code} - ${m.name}`,
                      subLabel: m.mdaType,
                    }))}
                    placeholder="Select Ministry / Agency..."
                    searchPlaceholder="Filter MDAs by code or name..."
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Current Department / Directorate *
                  </label>
                  <SearchableSelect
                    value={currentDepartmentId}
                    onChange={(val) => setCurrentDepartmentId(Number(val))}
                    options={filteredDepts.map((d) => ({
                      value: d.id.toString(),
                      label: d.departmentName,
                      subLabel: d.departmentCode,
                    }))}
                    placeholder="Select Department / Directorate..."
                    searchPlaceholder="Filter departments..."
                  />
                </div>
              </div>

              {/* Position and Grade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-semibold mb-1">
                    Designation / Position Title *
                  </label>
                  <input
                    type="text"
                    value={currentPositionTitle}
                    onChange={(e) => setCurrentPositionTitle(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-medium"
                    placeholder="e.g. Senior Human Resource Officer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Civil Service Grade Scale *
                  </label>
                  <SearchableSelect
                    value={currentGradeId}
                    onChange={(val) => {
                      const gId = Number(val);
                      setCurrentGradeId(gId);
                      const g = gradeLevels.find((gl) => gl.id === gId);
                      if (g) setCurrentSalaryLevel(g.hierarchyRank);
                    }}
                    options={gradeLevels.map((g) => ({
                      value: g.id.toString(),
                      label: g.gradeName,
                    }))}
                    placeholder="Select position title..."
                    searchPlaceholder="Type to filter by position title (e.g. Junior Clerk, Director)..."
                    dropdownClassName="right-0 w-[440px] sm:w-[480px] max-w-[92vw]"
                  />
                </div>
              </div>

              {/* Dates & Salary Step */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    First Appointment *
                  </label>
                  <input
                    type="date"
                    value={dateOfFirstAppointment}
                    onChange={(e) => setDateOfFirstAppointment(e.target.value)}
                    className="w-full h-8 px-2 rounded border border-slate-300 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Assumption of Duty *
                  </label>
                  <input
                    type="date"
                    value={dateOfAssumptionOfDuty}
                    onChange={(e) => setDateOfAssumptionOfDuty(e.target.value)}
                    className="w-full h-8 px-2 rounded border border-slate-300 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Salary Level
                  </label>
                  <input
                    type="number"
                    value={currentSalaryLevel}
                    onChange={(e) => setCurrentSalaryLevel(Number(e.target.value))}
                    className="w-full h-8 px-2 rounded border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Salary Step (1-10)
                  </label>
                  <SearchableSelect
                    value={currentSalaryStep}
                    onChange={(val) => setCurrentSalaryStep(Number(val))}
                    options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => ({
                      value: s.toString(),
                      label: `Step ${s}`,
                    }))}
                    placeholder="Select step..."
                    searchPlaceholder="Filter steps..."
                  />
                </div>
              </div>

              {/* Entry Grade, Promotion Date & Previous Posting */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    First Grade (Entry Grade)
                  </label>
                  <SearchableSelect
                    value={firstGradeId}
                    onChange={(val) => setFirstGradeId(val === '' ? '' : Number(val))}
                    options={gradeLevels.map((g) => ({
                      value: g.id.toString(),
                      label: g.gradeName,
                    }))}
                    placeholder="Select entry grade..."
                    searchPlaceholder="Filter grade scales..."
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Current Promotion Date
                  </label>
                  <input
                    type="date"
                    value={currentPromotionDate}
                    onChange={(e) => setCurrentPromotionDate(e.target.value)}
                    className="w-full h-8 px-2 rounded border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Previous Posting
                  </label>
                  <input
                    type="text"
                    value={previousPosting}
                    onChange={(e) => setPreviousPosting(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                    placeholder="e.g. HR Research Unit, Ministry of Finance"
                  />
                </div>
              </div>

              {/* Automatic Projections Banner */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Auto-projected Statutory Retirement Date: <strong>{estimatedRetDate}</strong>
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700">
                  (Based on 60 years of age or 35 years of service)
                </span>
              </div>
            </div>
          )}

          {activeTab === 'qualification' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                You can capture the initial highest qualification for this officer now, or add multiple qualifications later inside the Employee Dossier.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Qualification Level</label>
                  <SearchableSelect
                    value={qualLevel}
                    onChange={(val) => setQualLevel(val)}
                    options={[
                      { value: "Bachelor", label: "Bachelor's Degree" },
                      { value: "Master", label: "Master's Degree" },
                      { value: "Doctorate", label: "Doctorate (PhD)" },
                      { value: "HND", label: "Higher National Diploma (HND)" },
                      { value: "Diploma", label: "Diploma" },
                      { value: "WASSCE", label: "WASSCE / Secondary" },
                      { value: "Professional", label: "Professional Certification" },
                    ]}
                    placeholder="Select qualification level..."
                    searchPlaceholder="Filter levels..."
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Qualification Title</label>
                  <input
                    type="text"
                    value={qualTitle}
                    onChange={(e) => setQualTitle(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300"
                    placeholder="e.g. B.A. Political Science & Administration"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-semibold mb-1">Awarding Institution</label>
                  <input
                    type="text"
                    value={qualInstitution}
                    onChange={(e) => setQualInstitution(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300"
                    placeholder="e.g. University of Ghana, Legon"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Year Obtained</label>
                  <input
                    type="number"
                    value={qualYear}
                    onChange={(e) => setQualYear(Number(e.target.value))}
                    className="w-full h-8 px-2 rounded border border-slate-300 font-mono"
                    min="1960"
                    max="2030"
                  />
                </div>
              </div>

              {/* Professional Regulatory Memberships Section */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                      <Award className="w-3.5 h-3.5 text-blue-700" />
                      <span>Professional Regulatory Memberships (Optional)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Chartered institutes, statutory councils, and licensing bodies (max 10).
                    </p>
                  </div>

                  {memberships.length < 10 && (
                    <button
                      type="button"
                      onClick={() =>
                        setMemberships((prev) => [
                          ...prev,
                          {
                            professionalBody: '',
                            membershipNumber: '',
                            membershipCategory: 'Full Member',
                            registrationDate: new Date().toISOString().split('T')[0],
                            expiryDate: '',
                            membershipStatus: 'Active',
                          },
                        ])
                      }
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Membership</span>
                    </button>
                  )}
                </div>

                {memberships.length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 text-center text-xs text-slate-500">
                    No professional memberships added. Click <strong>+ Add Membership</strong> to register chartered or statutory body credentials.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {memberships.map((mem, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Membership #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setMemberships((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition-colors flex items-center space-x-1 text-[11px] font-semibold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Professional Body / Association *
                            </label>
                            <input
                              type="text"
                              value={mem.professionalBody}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMemberships((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, professionalBody: val } : item
                                  )
                                );
                              }}
                              className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs"
                              placeholder="e.g. Institute of Chartered Accountants, Ghana (ICAG)"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Membership Number *
                            </label>
                            <input
                              type="text"
                              value={mem.membershipNumber}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMemberships((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, membershipNumber: val } : item
                                  )
                                );
                              }}
                              className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs font-mono"
                              placeholder="e.g. ICAG-GH-4821"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Category
                            </label>
                            <input
                              type="text"
                              value={mem.membershipCategory}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMemberships((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, membershipCategory: val } : item
                                  )
                                );
                              }}
                              className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs"
                              placeholder="Full Member / Fellow"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Registration Date
                            </label>
                            <input
                              type="date"
                              value={mem.registrationDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMemberships((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, registrationDate: val } : item
                                  )
                                );
                              }}
                              className="w-full h-8 px-2 rounded border border-slate-300 bg-white text-xs font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Expiry Date (Optional)
                            </label>
                            <input
                              type="date"
                              value={mem.expiryDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMemberships((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, expiryDate: val } : item
                                  )
                                );
                              }}
                              className="w-full h-8 px-2 rounded border border-slate-300 bg-white text-xs font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Status
                            </label>
                            <select
                              value={mem.membershipStatus}
                              onChange={(e) => {
                                const val = e.target.value as 'Active' | 'Lapsed' | 'Suspended';
                                setMemberships((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, membershipStatus: val } : item
                                  )
                                );
                              }}
                              className="w-full h-8 px-2 rounded border border-slate-300 bg-white text-xs font-semibold"
                            >
                              <option value="Active">Active</option>
                              <option value="Lapsed">Lapsed</option>
                              <option value="Suspended">Suspended</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900">
                Capture the officer's role-related training capabilities and key skills. You can add or update these later inside the <strong>Employee Dossier</strong>. Both sections are optional.
              </div>

              <TrainingAndSkillsEditor
                capabilities={capabilities}
                onChangeCapabilities={setCapabilities}
                skills={skills}
                onChangeSkills={setSkills}
              />
            </div>
          )}

          {/* Footer Navigation Controls */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div>
              {activeTab !== 'personal' && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    if (activeTab === 'skills') setActiveTab('qualification');
                    else if (activeTab === 'qualification') setActiveTab('employment');
                    else if (activeTab === 'employment') setActiveTab('personal');
                  }}
                  className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  Previous Step
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>

              {activeTab !== 'skills' ? (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    if (activeTab === 'personal') setActiveTab('employment');
                    else if (activeTab === 'employment') setActiveTab('qualification');
                    else if (activeTab === 'qualification') setActiveTab('skills');
                  }}
                  className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {activeTab === 'qualification' ? 'Next Step \u2192' : 'Continue \u2192'}
                </button>
              ) : (
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs transition-colors"
                >
                  {isEditMode ? 'Save Changes' : 'Complete Registration'}
                </button>
              )}
            </div>
          </div>
        </form>
    </SlideOverPanel>
  );
};
