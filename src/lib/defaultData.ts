const values = [30.6345345, 40.234, 45, 50, 49, 60, 61, 64, 62, 66, 67, 67, 74, 82, 84, 87, 89, 91.55];
export const defaultData = values.map((data, idx) => {
	let start = new Date('November 1');
	let out = new Date(start.setDate(start.getDate() + idx));
	return {
		value: data,
		date: out
	};
});
