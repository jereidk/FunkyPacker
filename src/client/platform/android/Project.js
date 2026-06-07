class Project {
    static create(data) {
        return {
            getData: () => data,
            getVersion: () => '1.0'
        };
    }
    
    static async load(path) {
        return null;
    }
    
    static async save(path, data) {
        return false;
    }
}

export default Project;