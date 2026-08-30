import { XMLBuilder, XMLParser } from 'fast-xml-parser';

export type XmlData = {
	'@_name': string;
	value: string;
	comment?: string;
};

export class ResXParser extends XMLParser {
	constructor() {
		super({
			ignoreAttributes: ['xml:space'],
			attributeNamePrefix: '@_',
			isArray: (tagName) => tagName === 'data',
			parseTagValue: false,
		});
	}

	public parse(resxData: string): XmlData[] {
		return super.parse(resxData).data;
	}
}

export class ResXBuilder extends XMLBuilder {
	private readonly lineEnding: string;

	constructor(indent: string, lineEnding: string) {
		super({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
			format: true,
			indentBy: indent,
			suppressEmptyNode: true,
		});
		this.lineEnding = lineEnding;
	}

	public build(data: XmlData[]): string {
		if (data.length === 0) {
			return '';
		}
		data.forEach((obj) => {
			obj['@_xml:space'] = 'preserve';
		});
		// Wrap the data in a dummy root element for 1 level of indentation.
		const formatted: string = super.build({ a: { data: data } });
		// resx supports `"` and `'` without escaping
		return formatted
			.slice('<a>\n'.length, -'</a>\n'.length)
			.replaceAll('&quot;', '"')
			.replaceAll('&apos;', "'")
			.replaceAll('\n', this.lineEnding);
	}
}
