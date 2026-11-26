export const profileFields = [
    'Name',
    'Contact information',
    'Professional summary',
    'Employment history',
    'Education',
    'Technical skills',
    'Certifications',
    'Projects',
    'Achievements',
    'Portfolio links',
    'Professional interests',
    'Writing preferences'
] as const;
export type PersonalProfile = Partial<Record<(typeof profileFields)[number], string>>;
