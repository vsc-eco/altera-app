import mainnetSampleData from './mainnetSampleData';
export default function getSampleData(did: string) {
	// return mainnetSampleData;
	return mainnetSampleData.filter((value) => {
		const {
			required_auths: [req_auth],
			data: { from, to }
		} = value;
		return [req_auth, from, to].includes(did);
	});
}
