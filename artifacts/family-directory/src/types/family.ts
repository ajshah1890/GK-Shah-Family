export interface FamilyMember {
  id: string;
  fullName: string;
  photo?: string;
  birthday?: string;
  anniversary?: string;
  address?: string;
  mapsLink?: string;
  city?: string;
  country?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  profession?: string;
  company?: string;
  education?: string;
  bloodGroup?: string;
  mainFamilyBranch?: string;
  subFamilyBranch?: string;
  spouseName?: string;
  childrenNames?: string[];
  notes?: string;
}

export const SAMPLE_MEMBERS: FamilyMember[] = [
  {
    id: "1",
    fullName: "Ramesh Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ramesh",
    birthday: "1945-05-12",
    anniversary: "1968-12-05",
    city: "Mumbai",
    country: "India",
    phone: "+91 9876543210",
    whatsapp: "+91 9876543210",
    email: "ramesh.shah@example.com",
    profession: "Retired",
    bloodGroup: "O+",
    mainFamilyBranch: "Mumbai Branch",
    subFamilyBranch: "Elder Line",
    spouseName: "Sita Shah",
    childrenNames: ["Rajesh", "Pooja"]
  },
  {
    id: "2",
    fullName: "Sita Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sita",
    birthday: "1948-08-22",
    anniversary: "1968-12-05",
    city: "Mumbai",
    country: "India",
    phone: "+91 9876543211",
    whatsapp: "+91 9876543211",
    profession: "Homemaker",
    bloodGroup: "A+",
    mainFamilyBranch: "Mumbai Branch",
    subFamilyBranch: "Elder Line",
    spouseName: "Ramesh Shah",
    childrenNames: ["Rajesh", "Pooja"]
  },
  {
    id: "3",
    fullName: "Rajesh Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rajesh",
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
    mainFamilyBranch: "Ahmedabad Branch",
    spouseName: "Meena Shah",
    childrenNames: ["Ravi", "Sneha"]
  },
  {
    id: "4",
    fullName: "Pooja Mehta",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Pooja",
    birthday: "1975-11-08",
    anniversary: "2001-05-20",
    city: "London",
    country: "UK",
    phone: "+44 7700 900000",
    whatsapp: "+44 7700 900000",
    email: "pooja.mehta@example.com",
    profession: "Architect",
    bloodGroup: "O+",
    mainFamilyBranch: "London Branch",
    subFamilyBranch: "Younger Line"
  },
  {
    id: "5",
    fullName: "Meena Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Meena",
    birthday: "1974-07-30",
    anniversary: "1998-02-14",
    city: "Ahmedabad",
    country: "India",
    profession: "Teacher",
    bloodGroup: "A-",
    mainFamilyBranch: "Ahmedabad Branch",
    spouseName: "Rajesh Shah"
  },
  {
    id: "6",
    fullName: "Ravi Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ravi",
    birthday: "2000-09-10",
    city: "New York",
    country: "USA",
    phone: "+1 212 555 1234",
    email: "ravi.shah@example.com",
    profession: "Software Engineer",
    company: "Tech Corp",
    bloodGroup: "B+",
    mainFamilyBranch: "Ahmedabad Branch"
  },
  {
    id: "7",
    fullName: "Sneha Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha",
    birthday: "2004-12-05",
    city: "Ahmedabad",
    country: "India",
    profession: "Student",
    bloodGroup: "O+",
    mainFamilyBranch: "Ahmedabad Branch"
  },
  {
    id: "8",
    fullName: "Amit Shah",
    photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Amit",
    birthday: "1980-02-25",
    city: "Mumbai",
    country: "India",
    profession: "Doctor",
    bloodGroup: "AB+",
    mainFamilyBranch: "Mumbai Branch",
    subFamilyBranch: "Elder Line"
  }
];
