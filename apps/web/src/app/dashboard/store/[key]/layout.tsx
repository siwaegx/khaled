export function generateStaticParams() {
  return [
    { key: "crm" }, { key: "inventory" }, { key: "accounting" },
    { key: "hr" }, { key: "projects" }, { key: "reports" },
    { key: "contacts" }, { key: "calendar" },
  ];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
