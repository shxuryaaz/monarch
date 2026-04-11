import { BrandMark } from "@/components/BrandMark";

const Footer = () => {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          <BrandMark size="xs" />
          Monarch
        </span>
        <div className="flex gap-8">
          {["Terms", "Privacy", "Docs"].map((link) => (
            <a key={link} href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {link}
            </a>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">© 2026 Monarch. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
