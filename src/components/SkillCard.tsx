import { Skill } from "../types/skill";

interface SkillCardProps {
  skill: Skill;
  onClick: () => void;
}

export function SkillCard({ skill, onClick }: SkillCardProps) {
  return (
    <div
      onClick={onClick}
      className="p-5 bg-white border border-gray-100 rounded-xl cursor-pointer
                 hover:border-blue-300 hover:shadow-md transition-all duration-200
                 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-blue-500"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
          {skill.name}
        </h3>
        <div className="flex gap-1">
          {skill.isInstalled && (
            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full dark:bg-green-900 dark:text-green-300">
              Installed
            </span>
          )}
          {!skill.isFetched && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full dark:bg-slate-700 dark:text-gray-400">
              Not fetched
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {skill.owner}/{skill.repo}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 line-clamp-2">
        {skill.description}
      </p>
    </div>
  );
}
