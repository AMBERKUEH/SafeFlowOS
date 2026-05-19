export interface Nurse {
  id: string;
  name: string;
  skillLevel: 1 | 2 | 3 | 4;
  ward: 'ICU' | 'ER' | 'General' | 'Pediatrics';
  fatigue: number; // 0-100
  shifts: Array<{
    day: string;
    shift: 'Morning' | 'Afternoon' | 'Night';
    ward: 'ICU' | 'ER' | 'General' | 'Pediatrics';
  }>;
  unavailable_days?: string[]; // Pre-approved days off
  requests_honored?: boolean; // Whether unavailable_days were honored in schedule
}

export const nurses: Nurse[] = [
  {
    id: '1',
    name: 'Zhang Wei',
    skillLevel: 4,
    ward: 'ICU',
    fatigue: 85,
    shifts: [
      { day: 'Mon', shift: 'Morning', ward: 'ICU' },
      { day: 'Wed', shift: 'Night', ward: 'ICU' },
      { day: 'Fri', shift: 'Afternoon', ward: 'ICU' },
    ],
  },
  {
    id: '2',
    name: 'Wang Fang',
    skillLevel: 3,
    ward: 'ICU',
    fatigue: 72,
    shifts: [
      { day: 'Tue', shift: 'Morning', ward: 'ICU' },
      { day: 'Thu', shift: 'Night', ward: 'ICU' },
      { day: 'Sat', shift: 'Afternoon', ward: 'ICU' },
    ],
  },
  {
    id: '3',
    name: 'Li Ming',
    skillLevel: 2,
    ward: 'ER',
    fatigue: 58,
    shifts: [
      { day: 'Mon', shift: 'Afternoon', ward: 'ER' },
      { day: 'Wed', shift: 'Morning', ward: 'ER' },
      { day: 'Fri', shift: 'Night', ward: 'ER' },
    ],
  },
  {
    id: '4',
    name: 'Chen Hua',
    skillLevel: 3,
    ward: 'ER',
    fatigue: 45,
    shifts: [
      { day: 'Tue', shift: 'Afternoon', ward: 'ER' },
      { day: 'Thu', shift: 'Morning', ward: 'ER' },
      { day: 'Sat', shift: 'Night', ward: 'ER' },
    ],
  },
  {
    id: '5',
    name: 'Liu Yang',
    skillLevel: 1,
    ward: 'General',
    fatigue: 35,
    shifts: [
      { day: 'Mon', shift: 'Night', ward: 'General' },
      { day: 'Wed', shift: 'Afternoon', ward: 'General' },
      { day: 'Fri', shift: 'Morning', ward: 'General' },
    ],
  },
  {
    id: '6',
    name: 'Zhou Lan',
    skillLevel: 2,
    ward: 'General',
    fatigue: 52,
    shifts: [
      { day: 'Tue', shift: 'Night', ward: 'General' },
      { day: 'Thu', shift: 'Afternoon', ward: 'General' },
      { day: 'Sat', shift: 'Morning', ward: 'General' },
    ],
  },
  {
    id: '7',
    name: 'Huang Mei',
    skillLevel: 3,
    ward: 'Pediatrics',
    fatigue: 68,
    shifts: [
      { day: 'Mon', shift: 'Morning', ward: 'Pediatrics' },
      { day: 'Wed', shift: 'Night', ward: 'Pediatrics' },
      { day: 'Fri', shift: 'Afternoon', ward: 'Pediatrics' },
    ],
  },
  {
    id: '8',
    name: 'Xu Jun',
    skillLevel: 2,
    ward: 'Pediatrics',
    fatigue: 41,
    shifts: [
      { day: 'Tue', shift: 'Morning', ward: 'Pediatrics' },
      { day: 'Thu', shift: 'Night', ward: 'Pediatrics' },
      { day: 'Sun', shift: 'Afternoon', ward: 'Pediatrics' },
    ],
  },
];

export interface AgentMessage {
  id: string;
  type: 'SCHEDULING' | 'FORECAST' | 'COMPLIANCE' | 'EMERGENCY';
  message: string;
  timestamp: string;
}

export const agentMessages: AgentMessage[] = [
  {
    id: '1',
    type: 'SCHEDULING',
    message: 'Schedule optimized for minimal fatigue across all wards',
    timestamp: '14:32',
  },
  {
    id: '2',
    type: 'FORECAST',
    message: 'Predicted 12% increase in ER demand next Wednesday',
    timestamp: '14:33',
  },
  {
    id: '3',
    type: 'COMPLIANCE',
    message: 'All shifts meet regulatory minimum staffing requirements',
    timestamp: '14:34',
  },
  {
    id: '4',
    type: 'SCHEDULING',
    message: 'Night shifts balanced to avoid consecutive assignments',
    timestamp: '14:35',
  },
];

export const emergencyMessages: AgentMessage[] = [
  ...agentMessages,
  {
    id: '5',
    type: 'EMERGENCY',
    message: 'Nurse Zhang Wei sick — Wang Fang reassigned to ICU night',
    timestamp: '14:42',
  },
];
