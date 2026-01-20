from flask import Flask, render_template, jsonify, request
import json
import os
import logging
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

API_KEY = os.getenv('YOUTUBE_API_KEY')
youtube = build('youtube', 'v3', developerKey=API_KEY) if API_KEY else None

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'workoutdatabase.json')

def load_db():
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        app.logger.error(f"Error loading database: {e}")
        return []

def save_db(data):
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/workouts', methods=['GET'])
def get_workouts():
    workouts = load_db()
    return jsonify(workouts)

import re
from difflib import SequenceMatcher

def extract_video_id(url):
    # Supports various YouTube URL formats
    if not url: return None
    import re
    
    # Normalize
    url = url.strip()
    
    # 1. Short URL: https://youtu.be/ID
    # 2. Embed: https://www.youtube.com/embed/ID
    # 3. Watch: https://www.youtube.com/watch?v=ID
    # 4. Shorts: https://www.youtube.com/shorts/ID
    # 5. Just ID (11 chars)
    
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
        r'(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})',
        r'^([\w-]{11})$' # Explicit ID only
    ]
    
    for p in patterns:
        match = re.search(p, url)
        if match:
            return match.group(1)
            
    return None

def similarity(a, b):
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def get_youtube_client():
    # Priority: Header > Env Var
    api_key_header = request.headers.get('X-Youtube-Api-Key')
    if api_key_header:
        # Avoid crashing if header is invalid key format, although build() usually just works
        return build('youtube', 'v3', developerKey=api_key_header)
    
    # Fallback to env var if initialized
    if youtube: 
        return youtube
    return None

@app.route('/api/analyze', methods=['POST'])
def analyze_database():
    try:
        yt_client = get_youtube_client()
        if not yt_client:
            return jsonify({'error': 'No API Key provided. Please enter it above or configure .env'}), 500
        
        # Check for filtered IDs
        data = request.get_json(silent=True) or {}
        filter_ids = data.get('workout_ids', [])

        workouts = load_db()
        
        # Filter if IDs provided
        if filter_ids:
            workouts = [w for w in workouts if w.get('id') in filter_ids]
        
        # Collect IDs to fetch
        vid_map = {}
        for idx, w in enumerate(workouts):
            vid = extract_video_id(w.get('video_search_url'))
            if vid:
                if vid not in vid_map: vid_map[vid] = []
                vid_map[vid].append(idx)
        
        all_vids = list(vid_map.keys())
        video_details = {}
        
        # Chunking - Limit to 50
        max_batches = 1 
        for i in range(0, min(len(all_vids), 50 * max_batches), 50):
            batch = all_vids[i:i+50]
            try:
                resp = yt_client.videos().list(
                    part="snippet",
                    id=','.join(batch)
                ).execute()
                
                for item in resp.get('items', []):
                    video_details[item['id']] = {
                        'title': item['snippet']['title'],
                        'description': item['snippet']['description']
                    }
            except Exception as e:
                app.logger.error(f"Batch fetch failed: {e}")
                # Continue with what we have
                
        # Calculate scores
        results = {}
        for vid, details in video_details.items():
            for w_idx in vid_map.get(vid, []):
                w = workouts[w_idx]
                w_id = w['id']
                title_score = similarity(w['exercise_name'], details['title'])
                results[w_id] = {
                    'video_title': details['title'],
                    'video_description': details['description'],
                    'match_score': round(title_score * 100)
                }
                
        return jsonify(results)
    except Exception as e:
        app.logger.error(f"Analyze failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/search_videos', methods=['POST'])
def search_videos():
    try:
        yt_client = get_youtube_client()
        if not yt_client:
            return jsonify({'error': 'No API Key provided.'}), 500

        data = request.get_json(force=True, silent=True)
        if not data:
             return jsonify({'error': 'Invalid JSON body'}), 400
             
        query = data.get('query')
        exercise_name = data.get('exercise_name')
        
        if not query:
            return jsonify({'error': 'No query provided'}), 400
        
        search_query = f"{query} shorts"
        
        request_search = yt_client.search().list(
            part="snippet",
            maxResults=5,
            q=search_query,
            type="video"
        )
        response = request_search.execute()
        
        results = []
        for item in response['items']:
            video_id = item['id']['videoId']
            title = item['snippet']['title']
            desc = item['snippet']['description']
            thumbnails = item['snippet']['thumbnails']
            thumb_url = thumbnails.get('high', thumbnails.get('medium', thumbnails.get('default')))['url']
            
            match_score = 0
            if exercise_name:
                match_score = round(similarity(exercise_name, title) * 100)

            results.append({
                'videoId': video_id,
                'title': title,
                'description': desc,
                'thumbnail': thumb_url,
                'url': f"https://www.youtube.com/watch?v={video_id}",
                'embedUrl': f"https://www.youtube.com/embed/{video_id}",
                'match_score': match_score
            })
        return jsonify(results)
    except HttpError as e:
        error_reason = e.reader.decode('utf-8')
        if 'quotaExceeded' in error_reason:
             return jsonify({'error': 'QUOTA_EXCEEDED', 'message': 'YouTube Daily Limit Reached'}), 403
        
        if 'accessNotConfigured' in error_reason:
            return jsonify({'error': 'YouTube Data API v3 is not enabled. Please enable it in Google Cloud Console.'}), 403
        elif 'keyInvalid' in error_reason:
             return jsonify({'error': 'Invalid API Key.'}), 403
        return jsonify({'error': f"API Error: {e._get_reason()}"}), 500
    except Exception as e:
        app.logger.error(f"Search failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/resolve_video', methods=['POST'])
def resolve_video():
    try:
        yt_client = get_youtube_client()
        if not yt_client:
            return jsonify({'error': 'No API Key provided. Check your settings.'}), 500

        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({'error': 'Invalid JSON body'}), 400
            
        url = data.get('url')
        if not url:
            return jsonify({'error': 'No URL provided'}), 400

        video_id = extract_video_id(url)
        if not video_id:
            return jsonify({'error': 'Invalid YouTube URL. Could not extract Video ID.'}), 400

        # API Call
        resp = yt_client.videos().list(
            part="snippet",
            id=video_id
        ).execute()

        items = resp.get('items', [])
        if not items:
            return jsonify({'error': 'Video not found on YouTube (might be private or deleted).'}), 404

        item = items[0]
        snippet = item['snippet']
        thumbnails = snippet['thumbnails']
        # Safe thumbnail extraction
        thumb_url = thumbnails.get('high', thumbnails.get('medium', thumbnails.get('default', {}))).get('url', '')

        return jsonify({
            'videoId': item['id'],
            'title': snippet['title'],
            'description': snippet['description'],
            'thumbnail': thumb_url,
            'url': f"https://www.youtube.com/watch?v={item['id']}",
            'embedUrl': f"https://www.youtube.com/embed/{item['id']}"
        })
        
    except HttpError as e:
        error_reason = e.reader.decode('utf-8')
        if 'quotaExceeded' in error_reason:
             return jsonify({'error': 'QUOTA_EXCEEDED', 'message': 'YouTube Daily Limit Reached'}), 403

        if 'accessNotConfigured' in error_reason:
            return jsonify({'error': 'YouTube Data API not enabled.'}), 403
        return jsonify({'error': f"YouTube API Error: {e.resp.status} - {error_reason}"}), 500
    except Exception as e:
        app.logger.error(f"Resolve failed: {e}")
        return jsonify({'error': f"Server Error: {str(e)}"}), 500

@app.route('/api/update_workout', methods=['POST'])
def update_workout():
    data = request.json
    workout_id = data.get('workout_id')
    # Optional fields
    new_video_url = data.get('video_url')
    new_thumbnail = data.get('thumbnail_url')
    
    # New editable fields
    ex_name = data.get('exercise_name')
    cat = data.get('category')
    mat = data.get('material_name')
    instr = data.get('instructions')
    
    if not workout_id:
        return jsonify({'error': 'Missing workout_id'}), 400

    db_data = load_db()
    updated = False
    for workout in db_data:
        if workout.get('id') == workout_id:
            if new_video_url is not None: workout['video_search_url'] = new_video_url
            if new_thumbnail is not None: workout['thumbnail'] = new_thumbnail
            
            if ex_name is not None: workout['exercise_name'] = ex_name
            if cat is not None: workout['category'] = cat
            if mat is not None: workout['material_name'] = mat
            if instr is not None: workout['instructions'] = instr
            
            updated = True
            break
    
    if updated:
        save_db(db_data)
        return jsonify({'message': 'Workout updated successfully'})
    else:
        return jsonify({'error': 'Workout not found'}), 404

@app.route('/api/delete_workout', methods=['POST'])
def delete_workout():
    data = request.json
    workout_id = data.get('workout_id')
    
    if not workout_id:
        return jsonify({'error': 'Missing workout_id'}), 400
    
    db_data = load_db()
    new_data = [w for w in db_data if w.get('id') != workout_id]
    
    if len(new_data) < len(db_data):
        save_db(new_data)
        return jsonify({'message': 'Workout deleted successfully'})
    else:
        return jsonify({'error': 'Workout not found'}), 404

@app.route('/api/create_workout', methods=['POST'])
def create_workout():
    data = request.json
    # Required basic fields
    ex_name = data.get('exercise_name')
    if not ex_name: return jsonify({'error': 'Exercise Name is required'}), 400
    
    import time
    new_id = f"manual_{int(time.time()*1000)}"
    
    new_workout = {
        "check_number": 9999, # Placeholder, maybe calc max + 1?
        "id": new_id,
        "exercise_name": ex_name,
        "category": data.get('category', 'Hele Lichaam'),
        "material_name": data.get('material_name', 'Bodyweight'),
        "material_description": "",
        "instructions": data.get('instructions', ''),
        "video_search_url": "",
        "thumbnail": ""
    }
    
    db_data = load_db()
    # Optional: Fix check_number
    max_check = 0
    for w in db_data:
        if isinstance(w.get('check_number'), int):
            if w['check_number'] > max_check: max_check = w['check_number']
    new_workout['check_number'] = max_check + 1
    
    db_data.append(new_workout)
    save_db(db_data)
    
    return jsonify({'message': 'Workout created', 'workout': new_workout})

if __name__ == '__main__':
    app.run(debug=True, port=5050)
