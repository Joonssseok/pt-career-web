import type { LegalSection } from '@/lib/legal/documents'

export function LegalDocument({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-7 text-sm leading-7 text-slate-700">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-3 text-base font-semibold text-slate-950">
            {section.title}
          </h2>
          <div className="space-y-3">
            {section.paragraphs?.map((text) => (
              <p key={text}>{text}</p>
            ))}
            {section.bullets && (
              <ul className="list-disc space-y-2 pl-5">
                {section.bullets.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}
            {section.table && (
              <table className="w-full table-fixed border-collapse text-left text-xs leading-6 [overflow-wrap:anywhere]">
                <caption className="mb-2 text-left text-xs text-slate-500">
                  {section.table.caption}
                </caption>
                <thead>
                  <tr>
                    {section.table.headers.map((text) => (
                      <th
                        key={text}
                        scope="col"
                        className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-900"
                      >
                        {text}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((text, index) => (
                        <td
                          key={index}
                          className="border border-slate-200 px-3 py-2 align-top"
                        >
                          {text}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
