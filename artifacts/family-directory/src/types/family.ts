export interface FamilyMember {
  id: string;
  fullName: string;
  photo?: string;
  relationship: string;
  birthday?: string;
  anniversary?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  profession?: string;
  company?: string;
  education?: string;
  bloodGroup?: string;
  familyBranch?: string;
  spouseName?: string;
  childrenNames?: string[];
  notes?: string;
}

export const SAMPLE_MEMBERS: FamilyMember[] = [
  {
    id: "1",
    fullName: "Ramesh Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ramesh",
    relationship: "Patriarch",
    birthday: "1945-05-12",
    anniversary: "1968-12-05",
    city: "Mumbai",
    country: "India",
    phone: "+91 9876543210",
    whatsapp: "+91 9876543210",
    email: "ramesh.shah@example.com",
    profession: "Retired",
    bloodGroup: "O+",
    familyBranch: "Mumbai Branch",
    spouseName: "Sita Shah",
    childrenNames: ["Rajesh", "Pooja"]
  },
  {
    id: "2",
    fullName: "Sita Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sita",
    relationship: "Matriarch",
    birthday: "1948-08-22",
    anniversary: "1968-12-05",
    city: "Mumbai",
    country: "India",
    phone: "+91 9876543211",
    whatsapp: "+91 9876543211",
    profession: "Homemaker",
    bloodGroup: "A+",
    familyBranch: "Mumbai Branch",
    spouseName: "Ramesh Shah",
    childrenNames: ["Rajesh", "Pooja"]
  },
  {
    id: "3",
    fullName: "Rajesh Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rajesh",
    relationship: "Son",
    birthday: "1972-03-15",
    anniversary: "1998-02-14",
    city: "Ahmedabad",
    country: "India",
    phone: "+91 9876543212",
    whatsapp: "+91 9876543212",
    email: "rajesh.shah@example.com",
    profession: "Business Owner",
    company: "Shah Enterprises",
    bloodGroup: "B+",
    familyBranch: "Ahmedabad Branch",
    spouseName: "Meena Shah",
    childrenNames: ["Ravi", "Sneha"]
  },
  {
    id: "4",
    fullName: "Pooja Mehta",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Pooja",
    relationship: "Daughter",
    birthday: "1975-11-08",
    anniversary: "2001-05-20",
    city: "London",
    country: "UK",
    phone: "+44 7700 900000",
    whatsapp: "+44 7700 900000",
    email: "pooja.mehta@example.com",
    profession: "Architect",
    bloodGroup: "O+",
    familyBranch: "London Branch"
  },
  {
    id: "5",
    fullName: "Meena Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Meena",
    relationship: "Daughter-in-law",
    birthday: "1974-07-30",
    anniversary: "1998-02-14",
    city: "Ahmedabad",
    country: "India",
    profession: "Teacher",
    bloodGroup: "A-",
    familyBranch: "Ahmedabad Branch",
    spouseName: "Rajesh Shah"
  },
  {
    id: "6",
    fullName: "Ravi Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ravi",
    relationship: "Grandson",
    birthday: "2000-09-10",
    city: "New York",
    country: "USA",
    phone: "+1 212 555 1234",
    email: "ravi.shah@example.com",
    profession: "Software Engineer",
    company: "Tech Corp",
    bloodGroup: "B+",
    familyBranch: "Ahmedabad Branch"
  },
  {
    id: "7",
    fullName: "Sneha Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha",
    relationship: "Granddaughter",
    birthday: "2004-12-05",
    city: "Ahmedabad",
    country: "India",
    profession: "Student",
    bloodGroup: "O+",
    familyBranch: "Ahmedabad Branch"
  },
  {
    id: "8",
    fullName: "Amit Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Amit",
    relationship: "Nephew",
    birthday: "1980-02-25",
    city: "Mumbai",
    country: "India",
    profession: "Doctor",
    bloodGroup: "AB+",
    familyBranch: "Mumbai Branch"
  }
];
