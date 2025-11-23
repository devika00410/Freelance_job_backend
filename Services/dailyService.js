const axios = require('axios');

class dailyService {
    constructor() {
        this.apiKey = process.env.DAILY_API_KEY;
        this.baseURL = process.env.DAILY_API_URL || 'https://api.daily.co/v1';
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Daily.co Service initialized');
    }

    // Create a new video room
    async createRoom(roomConfig = {}) {
        try {
            console.log('Creating Daily.co room with config:', roomConfig);
            
            const defaultConfig = {
                privacy: 'private',
                properties: {
                    enable_chat: true,
                    enable_screenshare: true,
                    start_audio_off: false,
                    start_video_off: false,
                    exp: Math.round(Date.now() / 1000) + (60 * 60 * 24), // 24 hours default
                    max_participants: 4
                }
            };

            const mergedConfig = {
                ...defaultConfig,
                ...roomConfig,
                properties: {
                    ...defaultConfig.properties,
                    ...roomConfig.properties
                }
            };

            const response = await this.client.post('/rooms', mergedConfig);
            console.log('Daily.co room created:', response.data.name);
            
            return response.data;
        } catch (error) {
            console.error('Daily.co create room error:', error.response?.data || error.message);
            throw new Error('Failed to create video call room: ' + (error.response?.data?.error || error.message));
        }
    }

    // Get room details
    async getRoom(roomName) {
        try {
            const response = await this.client.get(`/rooms/${roomName}`);
            return response.data;
        } catch (error) {
            console.error('Daily.co get room error:', error.response?.data || error.message);
            throw new Error('Failed to get room details: ' + (error.response?.data?.error || error.message));
        }
    }

    // Delete a room
    async deleteRoom(roomName) {
        try {
            await this.client.delete(`/rooms/${roomName}`);
            console.log('Daily.co room deleted:', roomName);
            return true;
        } catch (error) {
            console.error('Daily.co delete room error:', error.response?.data || error.message);
            throw new Error('Failed to delete room: ' + (error.response?.data?.error || error.message));
        }
    }

    // Create meeting token for secure access
    async createMeetingToken(roomName, userId, userName, isOwner = false) {
        try {
            const tokenData = {
                properties: {
                    room_name: roomName,
                    user_id: userId,
                    user_name: userName,
                    is_owner: isOwner,
                    enable_screenshare: true,
                    enable_chat: true
                }
            };

            const response = await this.client.post('/meeting-tokens', tokenData);
            console.log('Daily.co meeting token created for user:', userId);
            
            return response.data.token;
        } catch (error) {
            console.error('Daily.co create token error:', error.response?.data || error.message);
            throw new Error('Failed to create meeting token: ' + (error.response?.data?.error || error.message));
        }
    }

    // Validate a meeting token
    async validateToken(token) {
        try {
            const response = await this.client.post('/meeting-tokens/validate', { token });
            return response.data;
        } catch (error) {
            console.error('Daily.co validate token error:', error.response?.data || error.message);
            throw new Error('Invalid meeting token: ' + (error.response?.data?.error || error.message));
        }
    }

    // Get room participants
    async getRoomParticipants(roomName) {
        try {
            const response = await this.client.get(`/rooms/${roomName}/participants`);
            return response.data;
        } catch (error) {
            console.error('Daily.co get participants error:', error.response?.data || error.message);
            throw new Error('Failed to get room participants: ' + (error.response?.data?.error || error.message));
        }
    }

    // End meeting for all participants
    async endMeeting(roomName) {
        try {
            await this.client.post(`/rooms/${roomName}/end`);
            console.log('Daily.co meeting ended for room:', roomName);
            return true;
        } catch (error) {
            console.error('Daily.co end meeting error:', error.response?.data || error.message);
            throw new Error('Failed to end meeting: ' + (error.response?.data?.error || error.message));
        }
    }

    // Update room properties
    async updateRoom(roomName, updateData) {
        try {
            const response = await this.client.post(`/rooms/${roomName}`, updateData);
            return response.data;
        } catch (error) {
            console.error('Daily.co update room error:', error.response?.data || error.message);
            throw new Error('Failed to update room: ' + (error.response?.data?.error || error.message));
        }
    }

    // Get daily usage statistics
    async getUsageStats(startDate, endDate) {
        try {
            const response = await this.client.get('/usage', {
                params: {
                    start_date: startDate,
                    end_date: endDate
                }
            });
            return response.data;
        } catch (error) {
            console.error('Daily.co get usage error:', error.response?.data || error.message);
            throw new Error('Failed to get usage statistics: ' + (error.response?.data?.error || error.message));
        }
    }

    // Check if room exists and is valid
    async validateRoom(roomName) {
        try {
            await this.getRoom(roomName);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Create room with specific expiration
    async createRoomWithExpiration(roomName, expirationHours = 24) {
        try {
            const expirationTime = Math.round(Date.now() / 1000) + (expirationHours * 60 * 60);
            
            const roomConfig = {
                name: roomName,
                privacy: 'private',
                properties: {
                    exp: expirationTime,
                    enable_chat: true,
                    enable_screenshare: true,
                    start_audio_off: false,
                    start_video_off: false,
                    max_participants: 4
                }
            };

            const response = await this.client.post('/rooms', roomConfig);
            return response.data;
        } catch (error) {
            console.error('Daily.co create room with expiration error:', error.response?.data || error.message);
            throw new Error('Failed to create room: ' + (error.response?.data?.error || error.message));
        }
    }

    // Batch create multiple rooms
    async createBatchRooms(roomConfigs) {
        try {
            const promises = roomConfigs.map(config => this.createRoom(config));
            const results = await Promise.allSettled(promises);
            
            const successful = results.filter(result => result.status === 'fulfilled').map(result => result.value);
            const failed = results.filter(result => result.status === 'rejected').map(result => result.reason);
            
            return {
                successful,
                failed
            };
        } catch (error) {
            console.error('Daily.co batch create rooms error:', error);
            throw new Error('Failed to create rooms in batch: ' + error.message);
        }
    }

    // Get all rooms (paginated)
    async getAllRooms(limit = 100, endingBefore = null) {
        try {
            const params = { limit };
            if (endingBefore) {
                params.ending_before = endingBefore;
            }

            const response = await this.client.get('/rooms', { params });
            return response.data;
        } catch (error) {
            console.error('Daily.co get all rooms error:', error.response?.data || error.message);
            throw new Error('Failed to get rooms list: ' + (error.response?.data?.error || error.message));
        }
    }
}

module.exports = new dailyService();