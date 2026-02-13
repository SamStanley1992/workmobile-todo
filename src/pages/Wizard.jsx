import React, { useContext } from "react";
import { ExternalLink } from "lucide-react";
import { DarkModeContext } from "../AppRoutes.jsx";

const WIZARD_URL = "https://dev1.esayworkmobile.co.uk/auth/sign-in";

export default function WizardPage() {
  const { darkMode } = useContext(DarkModeContext) || {};
  const panelClasses = darkMode
    ? "bg-gray-900/70 border-gray-700 text-gray-100"
    : "bg-white border-gray-200 text-gray-900";

  return (
    <div className="w-full">
      <div className={`border rounded-xl p-4 ${panelClasses}`}>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-start gap-2">
              <a
                href={WIZARD_URL}
                target="_blank"
                rel="noreferrer"
                className={`px-3 py-2 rounded border inline-flex items-center gap-2 ${darkMode ? "border-gray-700" : "border-gray-300"}`}
              >
                <ExternalLink className="h-4 w-4" />
                Open in new tab
              </a>
            </div>
          </div>
          <div className="flex-1">
            <div className="w-full h-[75vh] border rounded overflow-hidden">
              <iframe
                src={WIZARD_URL}
                title="Wizard"
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
