/**
 * Haros HRMIS - Staff Capability Form Editor
 * Captures Specific Training Capabilities relating to current role and Skills Possessed by Staff.
 * Reusable in StaffRegistrationModal (Wizard Step 4) and StaffDossierView.
 */

import React from 'react';
import { Plus, X, Award, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SkillCategory } from '../../types';
import { SearchableSelect } from '../common/SearchableSelect';

export interface SkillEntry {
  id?: number;
  skillName: string;
  category: SkillCategory | '';
  evidence: string;
}

interface TrainingAndSkillsEditorProps {
  capabilities: string[];
  onChangeCapabilities: (caps: string[]) => void;
  skills: SkillEntry[];
  onChangeSkills: (skills: SkillEntry[]) => void;
  validationError?: string;
  readOnly?: boolean;
}

export const SKILL_CATEGORIES: { value: SkillCategory; label: string; badgeColor: string }[] = [
  { value: 'Technical', label: 'Technical', badgeColor: 'bg-sky-100 text-sky-800 border-sky-300' },
  { value: 'Professional', label: 'Professional', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { value: 'Digital', label: 'Digital', badgeColor: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'Leadership', label: 'Leadership', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'Communication', label: 'Communication', badgeColor: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'Analytical', label: 'Analytical', badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { value: 'Interpersonal', label: 'Interpersonal', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' },
  { value: 'Other', label: 'Other', badgeColor: 'bg-slate-100 text-slate-800 border-slate-300' },
];

export const getCategoryBadgeStyle = (category?: string) => {
  const match = SKILL_CATEGORIES.find((c) => c.value === category);
  return match ? match.badgeColor : 'bg-slate-100 text-slate-700 border-slate-300';
};

export const TrainingAndSkillsEditor: React.FC<TrainingAndSkillsEditorProps> = ({
  capabilities,
  onChangeCapabilities,
  skills,
  onChangeSkills,
  validationError,
  readOnly = false,
}) => {
  // Capability Handlers
  const handleAddCapability = () => {
    if (capabilities.length >= 10) return;
    onChangeCapabilities([...capabilities, '']);
  };

  const handleUpdateCapability = (index: number, value: string) => {
    const updated = [...capabilities];
    updated[index] = value;
    onChangeCapabilities(updated);
  };

  const handleRemoveCapability = (index: number) => {
    const updated = capabilities.filter((_, i) => i !== index);
    onChangeCapabilities(updated.length > 0 ? updated : ['']);
  };

  // Skill Handlers
  const handleAddSkill = () => {
    if (skills.length >= 10) return;
    onChangeSkills([
      ...skills,
      {
        skillName: '',
        category: 'Technical',
        evidence: '',
      },
    ]);
  };

  const handleUpdateSkill = (index: number, patch: Partial<SkillEntry>) => {
    const updated = [...skills];
    updated[index] = { ...updated[index], ...patch };
    onChangeSkills(updated);
  };

  const handleRemoveSkill = (index: number) => {
    const updated = skills.filter((_, i) => i !== index);
    onChangeSkills(updated);
  };

  const validSkillsCount = skills.filter((s) => s.skillName.trim().length > 0).length;

  return (
    <div className="space-y-5 text-slate-800 text-xs">
      {/* Top Validation Error Banner */}
      {validationError && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* SECTION B: SPECIFIC TRAINING CAPABILITIES RELATING TO CURRENT ROLE */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h4 className="font-bold text-slate-900 text-xs tracking-wide uppercase">
              B. Specific Training Capabilities Relating to Current Role
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Technical capabilities the officer possesses that enable performance in the current role.
            </p>
          </div>

          {!readOnly && capabilities.length < 10 && (
            <button
              type="button"
              onClick={handleAddCapability}
              className="px-3 py-1.5 rounded-lg border border-blue-300 text-blue-700 bg-blue-50/60 hover:bg-blue-100 font-semibold text-xs flex items-center space-x-1 transition-colors self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Capability</span>
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {capabilities.map((capability, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={capability}
                  disabled={readOnly}
                  onChange={(e) => handleUpdateCapability(idx, e.target.value)}
                  placeholder="e.g. Public Financial Management & GIFMIS Ledger Processing"
                  className="w-full h-8 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-shadow bg-white"
                />
              </div>

              {!readOnly && (
                <button
                  type="button"
                  title="Remove this capability"
                  onClick={() => handleRemoveCapability(idx)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {capabilities.length === 0 && (
            <div className="text-center py-4 text-slate-400 text-xs italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No training capabilities added. Click "+ Add Capability" to record technical competencies.
            </div>
          )}
        </div>

        <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between">
          <span>Optional • Max 10 entries</span>
          <span>{capabilities.filter((c) => c.trim().length > 0).length} of 10 recorded</span>
        </div>
      </div>

      {/* SECTION E: SKILLS POSSESSED BY STAFF */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h4 className="font-bold text-slate-900 text-xs tracking-wide uppercase">
              E. Skills Possessed by Staff
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Key technical, professional, managerial and interpersonal skills.{' '}
              <strong className="text-blue-700 font-mono">{validSkillsCount}</strong> skill(s) added.
            </p>
          </div>

          {!readOnly && skills.length < 10 && (
            <button
              type="button"
              onClick={handleAddSkill}
              className="px-3 py-1.5 rounded-lg border border-blue-300 text-blue-700 bg-blue-50/60 hover:bg-blue-100 font-semibold text-xs flex items-center space-x-1 transition-colors self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Skill</span>
            </button>
          )}
        </div>

        <div className="space-y-3">
          {skills.map((skill, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2.5 relative"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                      Skill / Competency *
                    </label>
                    <input
                      type="text"
                      disabled={readOnly}
                      value={skill.skillName}
                      onChange={(e) => handleUpdateSkill(idx, { skillName: e.target.value })}
                      placeholder="e.g. Public Policy Formulation & Scheme of Service Review"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 placeholder-slate-400 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-700 font-semibold text-[11px]">
                        Category *
                      </label>
                      {skill.category && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase tracking-wider ${getCategoryBadgeStyle(
                            skill.category
                          )}`}
                        >
                          {skill.category}
                        </span>
                      )}
                    </div>
                    <SearchableSelect
                      disabled={readOnly}
                      value={skill.category}
                      onChange={(val) =>
                        handleUpdateSkill(idx, { category: val as SkillCategory })
                      }
                      options={[
                        { value: '', label: 'Select Category...' },
                        ...SKILL_CATEGORIES.map((cat) => ({ value: cat.value, label: cat.label })),
                      ]}
                      placeholder="Select Category..."
                      searchPlaceholder="Filter categories..."
                      buttonClassName="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                </div>

                {!readOnly && (
                  <button
                    type="button"
                    title="Remove this skill"
                    onClick={() => handleRemoveSkill(idx)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors mt-5 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1 text-[11px]">
                  Evidence / Application of Skill
                </label>
                <textarea
                  disabled={readOnly}
                  rows={2}
                  value={skill.evidence}
                  onChange={(e) => handleUpdateSkill(idx, { evidence: e.target.value })}
                  placeholder="Describe specific achievements, assignments, committees, or operational workflows demonstrating this competency..."
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs text-slate-900 placeholder-slate-400 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 resize-none"
                />
              </div>
            </div>
          ))}

          {skills.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No staff skills logged. Click "+ Add Skill" to record competencies and evidence of application.
            </div>
          )}
        </div>

        <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between">
          <span>Optional • Max 10 skills • Skill name and category required if any field is filled.</span>
          <span>{skills.length} of 10 slots</span>
        </div>
      </div>
    </div>
  );
};
