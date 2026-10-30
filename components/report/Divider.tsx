import GunGlyph from "@/components/effects/GunGlyph";

/** A playbill rule between report sections: brass hairlines with the gun in the middle. */
export default function Divider() {
  return (
    <div aria-hidden className="flex items-center gap-4 text-brass">
      <span className="h-px flex-1 bg-current opacity-60" />
      <span className="divider-gun inline-block">
        <GunGlyph className="block h-4 w-8" />
      </span>
      <span className="h-px flex-1 bg-current opacity-60" />
    </div>
  );
}
