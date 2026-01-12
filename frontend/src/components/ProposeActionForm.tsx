import type { FormField } from "../types";

interface ProposeActionFormProps {
  actionTitle: string;
  fields: FormField[];
  onSubmit: (data: Record<string, any>) => void | Promise<void>;
  onClose: () => void;
}

export const ProposeActionForm: React.FC<ProposeActionFormProps> = ({
  actionTitle,
  fields,
  onSubmit,
  onClose,
}) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, any> = {};

    fields.forEach((field) => {
      if (field.type === "checkbox-group" || field.multiSelect) {
        data[field.name] = formData.getAll(field.name);
      } else {
        const val = formData.get(field.name);
        data[field.name] = val instanceof File ? val.name : String(val);
      }
    });

    onSubmit(data);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h4 className="text-sm font-semibold text-white">{actionTitle}</h4>
      {fields.map((field) => (
        <div key={field.name}>
          <label
            htmlFor={field.name}
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            {field.label}
          </label>
          {field.type === "select" && field.options ? (
            <select
              name={field.name}
              id={field.name}
              required={!field.optional}
              multiple={field.multiSelect}
              className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : field.type === "checkbox-group" && field.options ? (
            <div className="space-y-2 bg-gray-800 border border-gray-600 rounded-md p-3">
              {field.options.map((option) => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name={field.name}
                    value={option.value}
                    className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
                  />
                  <span className="text-sm text-gray-200">{option.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <input
              type={field.type || "text"}
              name={field.name}
              id={field.name}
              placeholder={field.placeholder}
              required={!field.optional}
              className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
            />
          )}
        </div>
      ))}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Create Proposal
        </button>
      </div>
    </form>
  );
};
