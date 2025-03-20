let init_id = 0;

export function getUniqueId(): string {
	return (++init_id).toString();
}
