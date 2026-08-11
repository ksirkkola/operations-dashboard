// Workflow IDs
export const WORKFLOW_OPPORTUNITY = '6a041734fc4db70b8339a63e';
export const WORKFLOW_TRIPS_IHS = '6a211715b129621437c16b03';
export const WORKFLOW_SUPPORT_TICKETS = '6a06e492112c3668ef86bbd6';

// Saved insight IDs for the dashboard
export const INSIGHT_OPPORTUNITIES = '6a425d91199ea621d7fc4eb9';
export const INSIGHT_TRIPS_IHS = '6a425d97f150c40eb342bf59';
export const INSIGHT_SUPPORT_TICKETS = '6a425d9c199ea621d7fc4ed6';

// Support Ticket phase display colors
export const ST_PHASE_COLOR: Record<string, string> = {
  'New Ticket': 'blue',
  'Triage': 'yellow',
  'Working with Client': 'green',
  'Software Upgrade': 'cyan',
  'Follow-Up Activities': 'purple',
  'Waiting on Billing': 'orange',
};

export const OPP_PHASE_COLOR: Record<string, string> = {
  Discovery: 'blue',
  Proposal: 'purple',
  Negotiations: 'orange',
};

export const TRIPS_PHASE_COLOR: Record<string, string> = {
  Triage: 'blue',
  'Pre-Calibration Activities': 'cyan',
  'In Progress': 'green',
  'Follow-Up Activities': 'purple',
  'Waiting on PO': 'yellow',
  'Waiting on Dates': 'orange',
};
