export type Job = {
  id: string;
  title: string;
  department: string;
  location: string;
  type: 'Full-time' | 'Contract' | 'Freelance';
  description: string;
  requirements: string[];
};

export const jobs: Job[] = [
  {
    id: 'senior-3d-environment-artist',
    title: 'Senior 3D Environment Artist',
    department: 'Art',
    location: 'Remote / Hybrid',
    type: 'Full-time',
    description: 'We are looking for a Senior 3D Environment Artist to help build the breathtaking, derelict space stations for Project Nebula. You will work closely with the Art Director to establish the visual benchmark for our zero-g environments.',
    requirements: [
      '5+ years experience in game development, with at least one shipped AAA or high-quality indie title.',
      'Expertise in Maya, Blender, or 3ds Max.',
      'Strong understanding of PBR workflows and Unreal Engine 5 / Unity.',
      'Excellent portfolio demonstrating hard-surface modeling and atmospheric lighting.'
    ]
  },
  {
    id: 'gameplay-programmer',
    title: 'Gameplay Programmer (Physics)',
    department: 'Engineering',
    location: 'On-site (London)',
    type: 'Full-time',
    description: 'Join our engineering team to tackle the complex physics systems at the heart of Project Nebula. You will be responsible for creating stable, satisfying zero-g movement and combat mechanics.',
    requirements: [
      'Strong C++ programming skills.',
      'Experience with physics engines (Havok, PhysX, or custom).',
      'Solid math background (linear algebra, 3D math).',
      'Passion for deep, systems-driven gameplay.'
    ]
  }
];

export async function getJobs(): Promise<Job[]> {
  return jobs;
}

export async function getJobById(id: string): Promise<Job | undefined> {
  return jobs.find(j => j.id === id);
}
