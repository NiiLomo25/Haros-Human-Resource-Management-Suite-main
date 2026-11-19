/**
 * Haros HRMIS - Audit-to-Notification Semantic Mapper
 * Converts domain audit events into structured success, warning, error, and security notifications.
 */

import { AuditTrailLog } from '../../types';
import { NotifyPayload } from './notificationService';

function safeParseJson(raw?: string): Record<string, any> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function mapAuditEntryToNotification(
  entry: Omit<AuditTrailLog, 'id' | 'timestampUtc' | 'ipOrHost'>
): NotifyPayload | null {
  const newData = safeParseJson(entry.newValuesJson);
  const actor = entry.username || 'SYSTEM';
  const module = entry.module;
  const record = entry.recordId ? `#${entry.recordId}` : 'record';

  // Skip boot-time seed initialization
  if (entry.actionType === 'SYSTEM_INIT') {
    return null;
  }

  // 1. Security & Auth
  if (entry.module === 'Security & Auth') {
    if (entry.actionType === 'LOGIN') {
      const eventStr = String(newData?.event || '');
      if (eventStr.toLowerCase().includes('failed login')) {
        const attempts = Number(newData?.failedAttempts || 1);
        const remaining = Math.max(0, 5 - attempts);
        return {
          type: 'security',
          title: remaining === 0 ? 'Account Locked' : 'Failed Sign-In Attempt',
          message:
            remaining === 0
              ? `Account '${actor}' locked after 5 failed authentication attempts.`
              : `Invalid credentials for '${actor}'. ${remaining} attempt(s) remaining before lockout.`,
          module,
          actor,
        };
      }
      if (eventStr.toLowerCase().includes('logged out')) {
        return {
          type: 'security',
          title: 'Signed Out Safely',
          message: `Session closed for '${actor}'. All local WAL changes are persisted.`,
          module,
          actor,
        };
      }
      return {
        type: 'security',
        title: 'Authenticated Session Started',
        message: `Signed in as '${actor}' (${newData?.role || 'Authorized User'}).`,
        module,
        actor,
      };
    }

    if (entry.actionType === 'UPDATE' && entry.entityName === 'Users') {
      const eventStr = String(newData?.event || '');
      if (eventStr.toLowerCase().includes('administrative password reset')) {
        return {
          type: 'security',
          title: 'Administrative Password Reset',
          message: `Password reset and lockout cleared for user '${newData?.targetUsername || record}'.`,
          module,
          actor,
        };
      }
      return {
        type: 'security',
        title: 'Password Updated',
        message: `Security credentials updated for '${actor}'.`,
        module,
        actor,
      };
    }
  }

  // 2. User Management & RBAC
  if (entry.module === 'User Management') {
    if (entry.entityName === 'Users') {
      if (entry.actionType === 'INSERT') {
        return {
          type: 'security',
          title: 'User Account Created',
          message: `Provisioned account '${newData?.username || record}' (${newData?.role || 'Role assigned'}).`,
          module,
          actor,
        };
      }
      if (entry.actionType === 'DELETE') {
        return {
          type: 'security',
          title: 'User Account Removed',
          message: `Deleted user account ${record}.`,
          module,
          actor,
        };
      }
      const isDeactivated = newData && newData.isActive === false;
      return {
        type: 'security',
        title: isDeactivated ? 'User Account Deactivated' : 'User Access Updated',
        message: isDeactivated
          ? `User account ${record} has been deactivated.`
          : `Updated role/status for user account ${record}.`,
        module,
        actor,
      };
    }

    if (entry.entityName === 'Roles') {
      if (entry.actionType === 'DELETE') {
        return {
          type: 'security',
          title: 'Security Role Deleted',
          message: `Removed custom security role ${record}.`,
          module,
          actor,
        };
      }
      return {
        type: 'security',
        title: entry.actionType === 'INSERT' ? 'Security Role Created' : 'RBAC Permissions Modified',
        message:
          entry.actionType === 'INSERT'
            ? `Created role '${newData?.roleName || record}' with ${newData?.permissionsCount ?? 0} permission(s).`
            : `Updated permission matrix for role ${record}.`,
        module,
        actor,
      };
    }
  }

  // 3. Backup and Restore
  if (entry.module === 'Backup and Restore') {
    return {
      type: 'security',
      title: 'Database Snapshot Restored',
      message: `Restored ${newData?.tablesRestored ?? 'all'} relational tables with pre-restore safety backup.`,
      module,
      actor,
    };
  }

  // 4. System Configuration
  if (entry.module === 'System Configuration') {
    const isInstitutionChange =
      entry.recordId === 'INSTITUTION_NAME' || (newData && 'INSTITUTION_NAME' in newData);
    return {
      type: 'success',
      title: isInstitutionChange ? 'Institution Identity Updated' : 'System Configuration Saved',
      message: isInstitutionChange
        ? 'Official institution title updated across login portal, header, and reports.'
        : `Updated system setting (${entry.recordId || 'configuration'}).`,
      module,
      actor,
    };
  }

  // 5. Staff Registration & Management
  if (entry.module === 'Staff Registration' && entry.actionType === 'INSERT') {
    const staffLabel = newData?.fullName ? `${entry.recordId} (${newData.fullName})` : record;
    return {
      type: 'success',
      title: 'Staff Officer Registered',
      message: `Added ${staffLabel} to the active Civil Service Nominal Roll.`,
      module,
      actor,
    };
  }

  if (entry.module === 'Staff Management') {
    if (entry.actionType === 'DELETE') {
      return {
        type: 'warning',
        title: 'Staff Record Archived',
        message: `Employee ${entry.recordId || record} has been marked as deleted.`,
        module,
        actor,
      };
    }
    return {
      type: 'success',
      title: 'Staff Dossier Updated',
      message: `Saved personnel profile updates for officer ${record}.`,
      module,
      actor,
    };
  }

  if (
    entry.module === 'Staff Qualifications' ||
    entry.module === 'Professional Memberships' ||
    entry.module === 'Employment History' ||
    entry.module === 'Employee Documents' ||
    entry.module === 'Training Capabilities' ||
    entry.module === 'Staff Skills'
  ) {
    if (entry.actionType === 'DELETE') {
      return {
        type: 'warning',
        title: `${entry.module} Entry Removed`,
        message: `Removed record ${record} from employee dossier.`,
        module,
        actor,
      };
    }
    return {
      type: 'success',
      title: `${entry.module} Updated`,
      message: `Recorded dossier update (${entry.actionType.toLowerCase()}) for ${record}.`,
      module,
      actor,
    };
  }

  // 6. Organization & Establishment
  if (entry.module === 'Organization Structure' || entry.module === 'Establishment Management') {
    if (entry.actionType === 'DELETE') {
      return {
        type: 'warning',
        title: `${entry.entityName} Removed`,
        message: `Deleted ${entry.entityName} record ${record}.`,
        module,
        actor,
      };
    }
    return {
      type: 'success',
      title:
        entry.actionType === 'INSERT'
          ? `${entry.entityName} Created`
          : `${entry.entityName} Updated`,
      message: `Saved changes to ${entry.entityName} (${record}).`,
      module,
      actor,
    };
  }

  // 7. Staff Movements
  if (entry.module === 'Staff Movements') {
    if (entry.actionType === 'APPROVE_MOVEMENT') {
      return {
        type: 'success',
        title: 'Staff Movement Implemented',
        message: `Movement ${entry.recordId || record} executed and immutable service history archived.`,
        module,
        actor,
      };
    }
    if (entry.actionType === 'INSERT') {
      return {
        type: 'success',
        title: 'Staff Movement Initiated',
        message: `Created ${newData?.movementType || 'movement'} request ${entry.recordId || record}.`,
        module,
        actor,
      };
    }
    if (entry.actionType === 'DELETE') {
      return {
        type: 'warning',
        title: 'Staff Movement Removed',
        message: `Deleted movement directive ${entry.recordId || record}.`,
        module,
        actor,
      };
    }
    if (newData && 'status' in newData) {
      const status = String(newData.status);
      const isRejectedOrReturned = status === 'Rejected' || status === 'Returned';
      return {
        type: isRejectedOrReturned ? 'warning' : 'success',
        title: `Movement ${status}`,
        message: `Movement ${entry.recordId || record} moved to "${status}" stage.`,
        module,
        actor,
      };
    }
    return {
      type: 'success',
      title: 'Staff Movement Updated',
      message: `Updated details for movement directive ${entry.recordId || record}.`,
      module,
      actor,
    };
  }

  // 8. Recruitment & Appointments
  if (entry.module === 'Recruitment & Appointments') {
    if (entry.actionType === 'INSERT') {
      return {
        type: 'success',
        title: 'Applicant Logged',
        message: `Registered candidate ${entry.recordId || record} into recruitment pipeline.`,
        module,
        actor,
      };
    }
    if (entry.actionType === 'DELETE') {
      return {
        type: 'warning',
        title: 'Candidate Removed',
        message: `Removed candidate ${entry.recordId || record} from recruitment pipeline.`,
        module,
        actor,
      };
    }
    if (!newData || !('status' in newData)) {
      return {
        type: 'success',
        title: 'Applicant Profile Updated',
        message: `Saved profile edits for candidate ${entry.recordId || record}.`,
        module,
        actor,
      };
    }
    const status = String(newData.status);
    return {
      type: status === 'Rejected' ? 'warning' : 'success',
      title: `Applicant ${status}`,
      message: `Candidate ${entry.recordId || record} status updated to "${status}".`,
      module,
      actor,
    };
  }

  // 9. Promotion Management
  if (entry.module === 'Promotion Management') {
    if (entry.actionType === 'DELETE') {
      return {
        type: 'warning',
        title: 'Promotion Recommendation Removed',
        message: `Deleted promotion recommendation ${record}.`,
        module,
        actor,
      };
    }
    if (entry.actionType === 'UPDATE') {
      return {
        type: 'success',
        title: 'Promotion Recommendation Updated',
        message: `Updated promotion recommendation ${record}${newData?.status ? ` (${newData.status})` : ''}.`,
        module,
        actor,
      };
    }
    return {
      type: 'success',
      title: 'Promotion Recommendation Logged',
      message: `Submitted promotion recommendation ${record} for board review.`,
      module,
      actor,
    };
  }

  // 10. Leave Management
  if (entry.module === 'Leave Management') {
    if (entry.actionType === 'INSERT') {
      return {
        type: 'success',
        title: 'Leave Application Submitted',
        message: `Submitted leave request ${entry.recordId || record}.`,
        module,
        actor,
      };
    }
    if (entry.actionType === 'DELETE') {
      return {
        type: 'warning',
        title: 'Leave Application Withdrawn',
        message: `Withdrew and deleted leave request ${entry.recordId || record}.`,
        module,
        actor,
      };
    }
    if (!newData || !('status' in newData)) {
      return {
        type: 'success',
        title: 'Leave Application Updated',
        message: `Updated details for leave request ${entry.recordId || record}.`,
        module,
        actor,
      };
    }
    const status = String(newData.status);
    return {
      type: status === 'Rejected' ? 'warning' : 'success',
      title: `Leave ${status}`,
      message: `Leave application ${entry.recordId || record} marked as "${status}".`,
      module,
      actor,
    };
  }

  // 11. Attendance, Training, Performance
  if (
    entry.module === 'Attendance Management' ||
    entry.module === 'Training & Development' ||
    entry.module === 'Performance Management'
  ) {
    if (entry.actionType === 'DELETE') {
      return {
        type: 'warning',
        title: `${entry.module} Entry Removed`,
        message: `Deleted ${entry.entityName} record (${record}).`,
        module,
        actor,
      };
    }
    return {
      type: 'success',
      title: `${entry.module} Saved`,
      message: `Committed ${entry.entityName} ${entry.actionType.toLowerCase()} (${record}).`,
      module,
      actor,
    };
  }

  // 12. Payroll & Compensation
  if (entry.module === 'Payroll & Compensation') {
    if (entry.entityName === 'PayrollRuns') {
      if (entry.actionType === 'INSERT') {
        return {
          type: 'success',
          title: 'Payroll Run Computed',
          message: `Generated payroll batch ${entry.recordId || record} with automated tax & SSNIT deductions.`,
          module,
          actor,
        };
      }
      if (entry.actionType === 'DELETE') {
        return {
          type: 'warning',
          title: 'Payroll Run Deleted',
          message: `Deleted draft payroll batch ${entry.recordId || record}.`,
          module,
          actor,
        };
      }
      const status = String(newData?.status || 'Updated');
      return {
        type: status === 'Approved' || status === 'Disbursed' ? 'security' : 'success',
        title: `Payroll Run ${status}`,
        message: `Payroll batch ${entry.recordId || record} transitioned to "${status}".`,
        module,
        actor,
      };
    }
    if (entry.actionType === 'DELETE') {
      return {
        type: 'warning',
        title: 'Payroll Component Removed',
        message: `Deleted ${entry.entityName} entry ${record}.`,
        module,
        actor,
      };
    }
    return {
      type: 'success',
      title: 'Compensation Record Saved',
      message: `Updated ${entry.entityName} (${record}).`,
      module,
      actor,
    };
  }

  // 13. Retirement & Separation
  if (entry.module === 'Retirement & Separation') {
    if (entry.entityName === 'SeparationRecords' && entry.actionType === 'INSERT') {
      return {
        type: 'warning',
        title: 'Separation Process Initiated',
        message: `Created exit & clearance checklist for separation ${record}.`,
        module,
        actor,
      };
    }
    if (entry.entityName === 'SeparationRecords' && entry.actionType === 'DELETE') {
      return {
        type: 'warning',
        title: 'Separation Docket Removed',
        message: `Cancelled and deleted separation docket ${record}.`,
        module,
        actor,
      };
    }
    if (
      entry.entityName === 'SeparationRecords' &&
      String(newData?.event || '').toLowerCase().includes('officially executed')
    ) {
      return {
        type: 'warning',
        title: 'Separation Officially Executed',
        message: `Officer transitioned to "${newData?.newStatus || 'Separated'}" and deactivated from active roll.`,
        module,
        actor,
      };
    }
    if (entry.entityName === 'SeparationRecords') {
      return {
        type: 'success',
        title: 'Separation Docket Updated',
        message: `Updated separation record (${record}).`,
        module,
        actor,
      };
    }
    return {
      type: 'success',
      title: 'Separation Clearance Updated',
      message: `Saved ${entry.entityName} update (${record}).`,
      module,
      actor,
    };
  }

  // 14. Disciplinary Management
  if (entry.module === 'Disciplinary Management') {
    if (entry.actionType === 'DELETE') {
      return {
        type: 'warning',
        title: 'Disciplinary Docket Removed',
        message: `Removed disciplinary docket ${record}.`,
        module,
        actor,
      };
    }
    return {
      type: 'security',
      title:
        entry.actionType === 'INSERT'
          ? 'Disciplinary Docket Opened'
          : 'Disciplinary Case Updated',
      message:
        entry.actionType === 'INSERT'
          ? `Recorded case ${newData?.caseReference || record}${newData?.confidential ? ' (Confidential)' : ''}.`
          : `Updated disciplinary case ${record}${newData?.status ? ` to "${newData.status}"` : ''}.`,
      module,
      actor,
    };
  }

  // Fallback for any other action
  return {
    type: entry.actionType === 'DELETE' ? 'warning' : 'success',
    title: `${module} ${entry.actionType}`,
    message: `Processed ${entry.entityName} (${record}).`,
    module,
    actor,
  };
}
