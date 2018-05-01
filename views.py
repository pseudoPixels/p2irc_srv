from app_collaborative_sci_workflow import app_collaborative_sci_workflow
from flask import render_template



from flask import Flask,render_template,jsonify, g, redirect, url_for, session
from io import StringIO
import sys
import subprocess
import tempfile
from flask import request
import os
import uuid


#for couch db...
from couchdb.design import ViewDefinition
from flaskext.couchdb import CouchDBManager




views_by_user = ViewDefinition('hello', 'myind', '''
    function (doc) {
         if (doc.username && doc.password) {
            emit(doc._id, doc.password)
        };   
    }
    ''')

views_by_email = ViewDefinition('hello', 'findEmailAndPassword', '''
	function (doc) {
		if (doc.the_doc_type && doc.the_doc_type == 'p2irc_user') {
			emit(doc.email, doc._id)
		};
	}
	''')


views_by_non_validated_clones = ViewDefinition('hello', 'my_non_validated_clones', '''
    function (doc) {
         if (doc.is_clone_doc == 'yes' && doc.is_validated_by_any_user == 'no') {
            emit(doc._id, doc)
        };   
    }
    ''')

views_by_pipeline_module = ViewDefinition('hello', 'pipeline_module', '''
    function (doc) {
         if (doc.is_pipeline_module == 'yes') {
            emit(doc.module_id, doc._id)
        };   
    }
    ''')


views_by_saved_pipeline = ViewDefinition('hello', 'saved_pipeline', '''
    function (doc) {
         if (doc.the_doc_type && doc.the_doc_type == 'saved_pipeline') {
            emit(doc.author, doc._id)
        };   
    }
    ''')

views_by_workflow_locking_turn = ViewDefinition('hello', 'workflow_locking_turn', '''
    function (doc) {
         if (doc.the_doc_type && doc.the_doc_type == 'workflow_locking_turn') {
            emit(doc.workflow_id, doc._id)
        };
    }
    ''')


views_by_workflow_locking_module = ViewDefinition('hello', 'workflow_locking_module', '''
    function (doc) {
         if (doc.the_doc_type && doc.the_doc_type == 'workflow_locking_module') {
            emit(doc.workflow_id, doc._id)
        };
    }
    ''')


from flask import current_app as app


app = Flask(__name__)
app.config.update(
    COUCHDB_SERVER='http://localhost:5984',
    COUCHDB_DATABASE='plantphenotype'
)

manager = CouchDBManager()
with app.app_context():
	manager.setup(app)
	manager.add_viewdef([views_by_user, views_by_non_validated_clones, views_by_pipeline_module, views_by_email, views_by_saved_pipeline, views_by_workflow_locking_turn, views_by_workflow_locking_module])
	manager.sync(app)








@app_collaborative_sci_workflow.route('/collaborative_workflow')
def collaborative_workflow():
	return render_template('collaborative_workflow.html')













#---------------------------------------------------------------------------------------
#                    MAIN CODES 
#---------------------------------------------------------------------------------------


############ BIO STARTS #############################
import pandas
import networkx
import scipy.stats as stats

#this function removes data that is all zeros in a column
#best used once merging has taken place to get rid of all OTUs that are zero in both conditions
def remove_zero_data(df):
    return (df.loc[:, (df > min_count).any(axis=0)])

#Add one smoothing adds one to every cell then divides by the total, normalizing everything
#this is equivilent to having a uniform prior on the distriubtion of variables
#necessary for KL-Divergence calculation
def add_one_smoothing(df):
    temp  = df.copy() + 1
    temp = temp/df.sum()
    return temp

#this function computes the correlation matrix necessary to generate the graph
#any correlation supported by DataFrame.corr can be passed in
#Once MIC is implemented it will be added
def find_correlation(df, corr_type='spearman'):
    df_r = 0
    if corr_type == 'MIC':
        print('not yet implemented')
    else:
        df_r = df.corr(corr_type)
    if isinstance(df_r, pandas.DataFrame):
        df_r.fillna(0,inplace=True)  # ugly hack to make the NAs go away, should work for sampling but not advisable
        df_r = df_r[(df_r != 0).any(axis=1)]
        df_r = df_r.loc[:, (df_r != 0).any(axis=0)]

    return df_r

#this function returns the sorted centrality for a given centrality
#given a dataframe organized as an adjacency matrix, build a graph and compute the centrality
#return sorted centrality and the graph in networkx format
def find_centrality(df, cent_type='betweenness', keep_thresh=0.5):
    df_b = df.copy()
    df_b[(df.abs() < keep_thresh)] = 0 #eliminate edges that are too weak
    labels = list(df_b.index)
    temp = abs(df_b.copy())
    temp.insert(0, 'var1', labels)
    df_b = pandas.melt(temp, 'var1', var_name='var2', value_name='edge')
    df_b = df_b.loc[(df_b['edge'] > 0), :]  # take only those edge pairs that made the cut
    df_g = networkx.from_pandas_dataframe(df_b, 'var1', 'var2', 'edge')  # takes a list of valid edges
    if cent_type == 'betweenness':
        centrality = networkx.betweenness_centrality(df_g)
    elif cent_type == 'degree':
        centrality = networkx.degree_centrality(df_g)
    elif cent_type == 'closeness':
        centrality = networkx.closeness_centrality(df_g)
    elif cent_type == 'eigenvector':
        centrality = networkx.eigenvector_centrality(df_g)
    else:
        #print('error, unknown centrality')
        return -1
    centrality_df = pandas.DataFrame.from_dict(centrality, orient='index')
    centrality_df.sort_values(0, axis=0, ascending=False, inplace=True)
    centrality_df = centrality_df.transpose()

    return centrality_df, df_g

#this function returns the KL divergence of two matched dataframes
#if the dataframes have more than one dimension they are flattened
#dataframes cannot contain zeros
def find_kl_divergence(df_A, df_B):
    if len(df_A.shape) > 1: #if there is more than one dimension, flatten
        tempA = df_A.values.flatten()
    else:
        tempA = df_A.values

    if len(df_B.shape) > 1: #if there is more than one dimension, flatten
        tempB = df_B.values.flatten()
    else:
        tempB = df_B.values

    kl_diverge = stats.entropy(tempA, tempB, 2.0) #find the KL-Divergence base 2
    if kl_diverge > 1e50:
        kl_diverge = 1e50

    return kl_diverge

############ BIO ENDS #############################






#mainline program
#parameters necessary for the pipeline
#should be refactored as command line arguements in the future
in_file_path = 'bioFiles/'
out_file_path = 'bioFiles_out/'
num_to_pull = 1
corr_thresh = 0.4
min_count = 3
num_required = 50



@app_collaborative_sci_workflow.route('/bio')
def bio():
	

	#open the files
	brome1 = pandas.DataFrame.from_csv(in_file_path+'brome1A.csv') #read in input files
	brome2 = pandas.DataFrame.from_csv(in_file_path+'brome2A.csv')
	brome1_2 = brome1.append(brome2)
	#print("files read")

	#Do some initial data formatting and cleaning
	working_df_A = brome1.sum(axis=0).transpose() #KL divergence requires that histograms are the same size so sum to remove differences in number of samples
	working_df_B = brome2.sum(axis=0).transpose()
	working_df = add_one_smoothing(remove_zero_data(brome1_2.copy()))
	working_df_A = add_one_smoothing(working_df_A.loc[working_df.columns]) #make sure that everything has the same number of columns
	working_df_B = add_one_smoothing(working_df_B.loc[working_df.columns])

	#loop working variable declaration
	max_length = len(brome1_2.columns) #if you iterate over all OTUs you must be done
	i = 0
	downsampled_df = pandas.DataFrame()
	diverge_vals = []
	max_iter = len(working_df.columns)
	#this is the select N bit, needs to be refactored into a function, but it also controls the looping and
	#calls all the rest of the functions, so might wait until more components exist to do it right
	while num_required > i*num_to_pull and i < max_iter:
		w_corr_df = find_correlation(working_df) #find the correlation
		cent_df,corr_graph = find_centrality(w_corr_df) #find the centrality
		drop_list = list(cent_df.columns[0:num_to_pull]) #find the top N OTU names
		downsampled_df = downsampled_df.append(cent_df.loc[:,drop_list]) #append them to the solution
		working_df.drop(drop_list, inplace=True, axis=1) #drop them from the inputs
		working_df_A.drop(drop_list, inplace=True)
		working_df_B.drop(drop_list, inplace=True)
		diverge_vals.append(find_kl_divergence(working_df_A, working_df_B)) #determine if the remaining histograms are more alike after elimination
		#print(i) #output progress, should eventually refactor a silent mode
		#print(diverge_vals[i])
		#print(drop_list)
		i = i + 1


	#print('downsampling complete!')
	#output results
	#more results are possible from intermediate steps, should eventually refactor a verbose mode
	working_df_A.to_csv(out_file_path+'brome1A_pruned.csv')
	working_df_B.to_csv(out_file_path+'brome2A_pruned.csv')
	working_df.to_csv(out_file_path+'brome12A_pruned.csv')
	downsampled_df.to_csv(out_file_path+'brome12_down.csv')
	temp = pandas.Series(diverge_vals)
	temp.to_csv(out_file_path+'brome12_converge.csv')
	return render_template('index.html')







########CODE CLONE VALIDATION STARTS






from flaskext.couchdb import Document, TextField, FloatField, DictField, Mapping,ListField


# class PlantPhenotype(Document):
#     source = TextField()
#     imglink = TextField()
#     annotation = TextField()
class CodeClones(Document):
	

	clone_id = TextField()
	tool = DictField(Mapping.build(id=TextField(),name=TextField()))
	system = DictField(Mapping.build(
		id=TextField(),
		name=TextField()
	))
	fragment_1 = DictField(Mapping.build(
		path=TextField(),
		start_line=TextField(),
		end_line=TextField()
	))
	fragment_2 = DictField(Mapping.build(
		path=TextField(),
		start_line=TextField(),
		end_line=TextField()
	))
	auto_validation_result = ListField(DictField(Mapping.build(
		algorithm = TextField(),
		result = TextField()
	)))
	is_validated_by_any_user = TextField(default='no')
	is_clone_doc = TextField(default='yes')
	user_validation_result = ListField(DictField(Mapping.build(
		user = TextField(),
		result = TextField()
	)))



import pandas as pd
def load_dataSet(fileName, data_columns):
	data = pd.read_csv(fileName, sep=',', header=None)
	data.columns = data_columns
	return data


    
@app_collaborative_sci_workflow.route('/load_docs_from_csv')
def load_docs_from_csv():
	data_columns = ["clone_id","tool","system","fragment_1_path", "fragment_1_start","fragment_1_end", "fragment_2_path", "fragment_2_start", "fragment_2_end","neural_net", "svm"]
	data = load_dataSet('Dataset/fileinfotemp.csv', data_columns)

	for i in range(data.shape[0]):
		c = CodeClones()
		c.clone_id = data.at[i, 'clone_id']
		c.tool.id = data.at[i, 'tool']
		c.system.id = data.at[i, 'system']
		c.fragment_1.path = 'clones/' + str(data.at[i, 'fragment_1_path']).strip('"')
		c.fragment_1.start_line = data.at[i, 'fragment_1_start']
		c.fragment_1.end_line = data.at[i, 'fragment_1_end']
		c.fragment_2.path = 'clones/' + str(data.at[i, 'fragment_2_path']).strip('"')
		c.fragment_2.start_line = data.at[i, 'fragment_2_start']
		c.fragment_2.end_line = data.at[i, 'fragment_2_end']
		c.auto_validation_result.append(algorithm='Neural Network', result=data.at[i, 'neural_net'])
		c.auto_validation_result.append(algorithm='SVM', result=data.at[i, 'svm'])

		c.store()

	sources = []
	return render_template('codeclone_validation.html', content=sources)






import itertools

def getCodeFragment(path, start_line, end_line):
	codeFragment = ''
	with open(str(path).strip('"'), "r") as text_file:
		for line in itertools.islice(text_file, int(start_line), int(end_line)):
			codeFragment = codeFragment + line

	return codeFragment






#############################################################################
################## PIPELINE SAVING STARTS HERE ##############################
class PipelineModule(Document):
	module_id = TextField()
	module_name = TextField()
	author = TextField()
	code_link_main = TextField()
	code_link_settings = TextField()
	code_link_html = TextField()
	documentation  = TextField()


class SavedPipeline(Document):
	pipeline_name = TextField()
	author = TextField()
	pipeline_link = TextField()
	the_doc_type = TextField(default='saved_pipeline')
	shared_with = ListField(TextField())


class P2IRC_User(Document):
	first_name =  TextField()
	last_name = TextField() 
	email = TextField() 
	password = TextField()
	the_doc_type = TextField(default='p2irc_user')
	user_role = TextField(default='plant_scientist')



from io import StringIO
import sys
@app_collaborative_sci_workflow.route('/pythoncom/',  methods=['POST'])
def Python_com():

	program = request.form['textarea_source_code']
	#program = 'for i in range(3):\n    print("Python is cool")'

	
	old_stdout = sys.stdout
	redirected_output = sys.stdout = StringIO()
	exec(program)
	sys.stdout = old_stdout

	return redirected_output.getvalue()
	#return jsonify(res)
	#return jsonify({'allTasks':tasks})

import os.path
from enum import Enum

def getTotalJobStates(jobStates, jobCount, state):
	jobStateCount = 0
	for i in range(jobCount):
		if jobStates[i] == state:
			jobStateCount += 1
	return jobStateCount

@app_collaborative_sci_workflow.route('/workflow_job_manager/', methods=['POST'])
def workflow_job_manager():
	#print(request.is_json)

	#print( jsonify( request.get_json()) )
	#for aJob in  request.get_json()[0] :
	#	print(aJob['moduleID'])

	#print(request.get_json()['jobDefinition'][0]['moduleID'])

	jobCounts = len(request.get_json()['jobDefinition'])
	print('Total Number of Jobs ', jobCounts)


	# 0 => Not Started
	# 1 => Running
	# 2 => Finished
	# 3 => Failed

	jobStates = [0 for x in range(jobCounts)]

	print('Number of Job yet to start =>', getTotalJobStates(jobStates, jobCounts, 0))

	#msg = ''

	#while there is at least one job to get started.
	while getTotalJobStates(jobStates, jobCounts, 0) > 0:
		didAnyJobStarted = False
		for i in range(jobCounts):
			if jobStates[i] != 0:# this job was already handled/started.
				continue
			#print( 'Data Dependency for -> ' , request.get_json()['jobDefinition'][i]['moduleID'])
			dataDependencyCount = len(request.get_json()['jobDefinition'][i]['dataDependecnyList'])
			isThisJobReadyToStart = True
			for j in range(dataDependencyCount):
				aDataPath = request.get_json()['jobDefinition'][i]['dataDependecnyList'][j]
				#print(aDataPath, " ==> ", os.path.exists(aDataPath[1:-1]))
				if os.path.exists(aDataPath[1:-1]) == False:
					isThisJobReadyToStart = False
					break
			if isThisJobReadyToStart == True:
				didAnyJobStarted = True
				jobStates[i] = 1 #Running
				print('Running Job -> ' , request.get_json()['jobDefinition'][i]['moduleID'])
				old_stdout = sys.stdout
				redirected_output = sys.stdout = StringIO()
				exec(request.get_json()['jobDefinition'][i]['sourceCode'])
				sys.stdout = old_stdout
				jobStates[i] = 2 #Finished
				print('Finished Job -> ', request.get_json()['jobDefinition'][i]['moduleID'])
		if didAnyJobStarted == False: #NO JOB STARTED in the last pass, there must be some error in workflow DAG
			print('COULD NOT START ANY JOB !!!')
			break


	return jsonify({'output': 'ok'})


# return jsonify(res)
# return jsonify({'allTasks':tasks})




def getModuleCodes(path):
	sourceCode = ''
	with open(path) as f:
		for line in f:
			sourceCode = sourceCode + line

	return sourceCode

def getSavedPipelines(author):
	saved_pipelines = []
	for row in (views_by_saved_pipeline(g.couch)):
		if row.key == author:
			doc_id = row.value
			thisSavedPipeline = SavedPipeline.load(doc_id)
			pipeline_name = thisSavedPipeline.pipeline_name
			pipeline_link = thisSavedPipeline.pipeline_link

			saved_pipelines.append({'doc_id':doc_id, 'pipeline_name': pipeline_name, 'pipeline_link': pipeline_link})

	return saved_pipelines

def getSharedPipelines(author):
	shared_pipelines = []
	for row in (views_by_saved_pipeline(g.couch)):
		doc_id = row.value
		thisSavedPipeline = SavedPipeline.load(doc_id)
		for i in range(len(thisSavedPipeline.shared_with)):
			if thisSavedPipeline.shared_with[i] == author:
				pipeline_name = thisSavedPipeline.pipeline_name
				pipeline_link = thisSavedPipeline.pipeline_link
				shared_pipelines.append({'doc_id':doc_id, 'pipeline_name': pipeline_name, 'pipeline_link': pipeline_link})

	return shared_pipelines


#get all the other user details, except this user
def getAllUsersDetails(thisUserEmail):
	all_user_details = []
	for row in (views_by_email(g.couch)):
		doc_id = row.value
		thisUser = P2IRC_User.load(doc_id)

		#do not add this user to the list
		if thisUser.email != thisUserEmail:
			userName = thisUser.first_name + " " +thisUser.last_name
			userEmail = thisUser.email
			userRole = thisUser.user_role

			#append this user to the list
			all_user_details.append({'userName':userName, 'userEmail': userEmail, 'userRole':userRole})

	return all_user_details











import html
import re
@app_collaborative_sci_workflow.route('/cvs')
def cvs():

	#TODO: REMOVE WHEN DEBUGGLING FOR LOCKING DONE
	#Remove all existing documents
	for row in views_by_workflow_locking_turn(g.couch):
		tmp = WorkflowLockingTurn.load(row.value)
		g.couch.delete(tmp)

	#Add one doc
	turnBasedLocking = WorkflowLockingTurn(workflow_id='workflow_turn_id_1')
	turnBasedLocking.store()

	module = ''
	for row in views_by_pipeline_module(g.couch):
		if row.key == 'rgb2gray':
			module = PipelineModule.load(row.value)

	moduleSourceCode_main = ''#getModuleCodes(module.code_link_main)
	moduleSourceCode_settings = ''#getModuleCodes(module.code_link_settings)
	moduleSourceCode_html = ''#getModuleCodes(module.code_link_html)

	#load user details...
	row = (views_by_email(g.couch))[session.get('p2irc_user_email')]
	p2irc_user = P2IRC_User.load(list(row)[0].value)
	first_name = p2irc_user.first_name
	last_name = p2irc_user.last_name
	email = p2irc_user.email
	user_role = p2irc_user.user_role
	#store the user role in session
	session['user_role'] = user_role

	#get the list of all saved pipelines from DB
	saved_pipelines = getSavedPipelines(session.get('p2irc_user_email'))
	#get the list of all shared pipelines with this user from DB
	shared_pipelines = getSharedPipelines(session.get('p2irc_user_email'))
	#get all other user details
	all_other_users = getAllUsersDetails(session.get('p2irc_user_email'))


	pineline_modules = os.listdir("app_collaborative_sci_workflow/pipeline_modules/")

	pineline_source_analysis_modules = [f for f in os.listdir('app_collaborative_sci_workflow/pipeline_modules/') if re.match(r'NiCAD*', f)] #os.listdir("app_collaborative_sci_workflow/pipeline_modules/source_analysis_tools/")

	pineline_mathematical_analysis_modules = [f for f in os.listdir('app_collaborative_sci_workflow/pipeline_modules/') if
										re.match(r'Math*', f)]



	saved_workflows = os.listdir("app_collaborative_sci_workflow/pipeline_saved/")


	return render_template('cloud_vision_pipeline_save2GO.html', # change to cloud_vision_pipeline_save2.html for normal (without GO, which is in testing phase)
	module_name = '',#module.module_name,
	documentation = '',#module.documentation,
	moduleSourceCode_settings = moduleSourceCode_settings,
	moduleSourceCode_main = moduleSourceCode_main,
	moduleSourceCode_html = moduleSourceCode_html,
	first_name = first_name,
	last_name = last_name,
	email = email,
	user_role = user_role,
	saved_pipelines = saved_pipelines,
	shared_pipelines = shared_pipelines,
    all_other_users=all_other_users,
    pineline_modules=pineline_modules,
	pineline_source_analysis_modules=pineline_source_analysis_modules,
	pineline_mathematical_analysis_modules=pineline_mathematical_analysis_modules,
	saved_workflows=saved_workflows)









@app_collaborative_sci_workflow.route('/cvs_module_locking')
def cvs_module_locking():
	module = ''
	for row in views_by_pipeline_module(g.couch):
		if row.key == 'rgb2gray':
			module = PipelineModule.load(row.value)

	moduleSourceCode_main = ''#getModuleCodes(module.code_link_main)
	moduleSourceCode_settings = ''#getModuleCodes(module.code_link_settings)
	moduleSourceCode_html = ''#getModuleCodes(module.code_link_html)

	#load user details...
	row = (views_by_email(g.couch))[session.get('p2irc_user_email')]
	p2irc_user = P2IRC_User.load(list(row)[0].value)
	first_name = p2irc_user.first_name
	last_name = p2irc_user.last_name
	email = p2irc_user.email
	user_role = p2irc_user.user_role
	#store the user role in session
	session['user_role'] = user_role

	#get the list of all saved pipelines from DB
	saved_pipelines = getSavedPipelines(session.get('p2irc_user_email'))
	#get the list of all shared pipelines with this user from DB
	shared_pipelines = getSharedPipelines(session.get('p2irc_user_email'))
	#get all other user details
	all_other_users = getAllUsersDetails(session.get('p2irc_user_email'))







	return render_template('cloud_vision_pipeline_save_module_locking.html',
	module_name = '',#module.module_name,
	documentation = '',#module.documentation,
	moduleSourceCode_settings = moduleSourceCode_settings,
	moduleSourceCode_main = moduleSourceCode_main,
	moduleSourceCode_html = html.unescape(moduleSourceCode_html),
	first_name = first_name,
	last_name = last_name,
	email = email,
	user_role = user_role,
	saved_pipelines = saved_pipelines,
	shared_pipelines = shared_pipelines,
    all_other_users=all_other_users)










@app_collaborative_sci_workflow.route('/cvs_atrr_level_locking')
def cvs_atrr_level_locking():
	#module = ''
	#for row in views_by_pipeline_module(g.couch):
	#	if row.key == 'rgb2gray':
	#		module = PipelineModule.load(row.value)

	moduleSourceCode_main = ''#getModuleCodes(module.code_link_main)
	moduleSourceCode_settings = ''#getModuleCodes(module.code_link_settings)
	moduleSourceCode_html = ''#getModuleCodes(module.code_link_html)

	#load user details...
	row = (views_by_email(g.couch))[session.get('p2irc_user_email')]
	p2irc_user = P2IRC_User.load(list(row)[0].value)
	first_name = p2irc_user.first_name
	last_name = p2irc_user.last_name
	email = p2irc_user.email
	user_role = p2irc_user.user_role
	#store the user role in session
	session['user_role'] = user_role

	#get the list of all saved pipelines from DB
	saved_pipelines = getSavedPipelines(session.get('p2irc_user_email'))
	#get the list of all shared pipelines with this user from DB
	shared_pipelines = getSharedPipelines(session.get('p2irc_user_email'))
	#get all other user details
	all_other_users = getAllUsersDetails(session.get('p2irc_user_email'))







	return render_template('cloud_vision_pipeline_save_attr_level_locking.html',
	module_name = '',#module.module_name,
	documentation = '',#module.documentation,
	moduleSourceCode_settings = moduleSourceCode_settings,
	moduleSourceCode_main = moduleSourceCode_main,
	moduleSourceCode_html = html.unescape(moduleSourceCode_html),
	first_name = first_name,
	last_name = last_name,
	email = email,
	user_role = user_role,
	saved_pipelines = saved_pipelines,
	shared_pipelines = shared_pipelines,
    all_other_users=all_other_users)





















@app_collaborative_sci_workflow.route('/webrtctest')
def webrtctest():
	return render_template('webrtctest.html')


@app_collaborative_sci_workflow.route('/get_module_details',  methods=['POST'])
def get_module_details():
	p_module_key = request.form['p_module_key']
	#module = ''
	#for row in views_by_pipeline_module(g.couch):
	#	if row.key == p_module_key: #'rgb2gray'
	#		module = PipelineModule.load(row.value)

	#moduleSourceCode_main = getModuleCodes(module.code_link_main)
	#moduleSourceCode_settings = getModuleCodes(module.code_link_settings)
	#moduleSourceCode_html = getModuleCodes(module.code_link_html)


	modulesPath = 'app_collaborative_sci_workflow/pipeline_modules/'
	
	#moduleSourceCode_main = getModuleCodes(modulesPath+'biodatacleaning/biodatacleaning_main.py')
	#moduleSourceCode_settings = getModuleCodes(modulesPath+'biodatacleaning/biodatacleaning_settings.py')
	#moduleSourceCode_html = getModuleCodes(modulesPath+'biodatacleaning/biodatacleaning_html.txt')

	
	moduleSourceCode_main = getModuleCodes(modulesPath+p_module_key+'/'+p_module_key+'_main.py')
	moduleSourceCode_settings = getModuleCodes(modulesPath+p_module_key+'/'+p_module_key+'_settings.py')
	moduleSourceCode_html = getModuleCodes(modulesPath+p_module_key+'/'+p_module_key+'_html.txt')
	module_documentation = getModuleCodes(modulesPath+p_module_key+'/'+p_module_key+'_doc.txt')



	
	return jsonify({ 'module_name':p_module_key,#module.module_name,
	'documentation': module_documentation,#module.documentation, 
	'moduleSourceCode_settings': moduleSourceCode_settings,
	'moduleSourceCode_main': moduleSourceCode_main,
	'moduleSourceCode_html': moduleSourceCode_html,
	'user_role': session.get('user_role') })


@app_collaborative_sci_workflow.route('/load_output_for_visualization', methods=['POST'])
def load_output_for_visualization():
	fileName= request.form['fileName']


	output = getModuleCodes('app_collaborative_sci_workflow/workflow_outputs/test_workflow/'+ fileName)



	return jsonify({'output': output})





@app_collaborative_sci_workflow.route('/save_pipeline/',  methods=['POST'])
def save_pipeline():
	program = request.form['textarea_source_code']
	pipeline_name =  request.form['pipelineName']


	#save the pipeline to file system
	f = open('app_collaborative_sci_workflow/pipeline_saved/'+pipeline_name+'.wc', 'w')
	f.write(program)
	f.close()

	#save piepline information to database
	#saved_pipeline = SavedPipeline()
	#saved_pipeline.pipeline_name = pipeline_name
	#saved_pipeline.author = session.get('p2irc_user_email')
	#saved_pipeline.pipeline_link = 'pipeline_saved/'+pipeline_name

	#saved_pipeline.store()

	return jsonify({'success': 1})


@app_collaborative_sci_workflow.route('/get_saved_workflow', methods=['POST'])
def get_saved_workflow():
	workflow_id = request.form['workflow_id']


	savedWorkflowPath = 'app_collaborative_sci_workflow/pipeline_saved/' + workflow_id #mySavedPipeline.gom' #+workflow_id


	# moduleSourceCode_main = getModuleCodes(modulesPath+'biodatacleaning/biodatacleaning_main.py')
	# moduleSourceCode_settings = getModuleCodes(modulesPath+'biodatacleaning/biodatacleaning_settings.py')
	# moduleSourceCode_html = getModuleCodes(modulesPath+'biodatacleaning/biodatacleaning_html.txt')

	savedWorkflow = getModuleCodes(savedWorkflowPath)
	#moduleSourceCode_main = getModuleCodes(modulesPath + p_module_key + '/' + p_module_key + '_main.py')
	#moduleSourceCode_settings = getModuleCodes(modulesPath + p_module_key + '/' + p_module_key + '_settings.py')
	#moduleSourceCode_html = getModuleCodes(modulesPath + p_module_key + '/' + p_module_key + '_html.txt')
	#module_documentation = getModuleCodes(modulesPath + p_module_key + '/' + p_module_key + '_doc.txt')

	return jsonify({'savedWorkflow': savedWorkflow})




#Login and Sign Ups for TURN BASED COLLABORATION
@app_collaborative_sci_workflow.route('/p2irc_turnBased_')
def p2irc_turnBased():
	return render_template('login_turnBased.html')


#Login and Sign Ups for MODULE LOCKING COLLABORATION
@app_collaborative_sci_workflow.route('/p2irc_moduleLocking')
def p2irc_moduleLocking():
	return render_template('login_moduleLocking.html')


#Login and Sign ups for FINE GRAINED COLLABORATION (proposed)
@app_collaborative_sci_workflow.route('/p2irc_fineGrained')
def p2irc_fineGrained():
	return render_template('login_fineGrained.html')









@app_collaborative_sci_workflow.route('/p2irc_signup/',  methods=['POST'])
def p2irc_signup():
	first_name = request.form['first_name']
	last_name = request.form['last_name']
	email = request.form['email']
	password = request.form['password']


	p2irc_usr = P2IRC_User()
	p2irc_usr.first_name = first_name
	p2irc_usr.last_name = last_name 
	p2irc_usr.email = email
	p2irc_usr.password = password

	p2irc_usr.store()

	return jsonify({'success': 1})


#User Login Verification (TURN BASED)
@app_collaborative_sci_workflow.route('/p2irc_login_turnBased/',  methods=['POST'])
def p2irc_login_turnBased():
	email = request.form['email']
	password = request.form['password']

	row = (views_by_email(g.couch))[email]


	p2irc_user = ''
	if not row :
		return redirect(url_for('app_collaborative_sci_workflow.p2irc_turnBased'))
	else:
		p2irc_user = P2IRC_User.load(list(row)[0].value)

	if p2irc_user.email != email or p2irc_user.password != password:
		return redirect(url_for('app_collaborative_sci_workflow.p2irc_turnBased'))
	else:
		#first_name = p2irc_user.first_name
		#last_name = p2irc_user.last_name
		#email = p2irc_user.email
		session['p2irc_user_email'] = email
		return redirect(url_for('app_collaborative_sci_workflow.cvs')) #turn based collaboration... uncomment for this feature
		#return redirect(url_for('app_collaborative_sci_workflow.cvs_module_locking')) #modular locking based collaboration... uncomment for this feature
		#return redirect(url_for('app_collaborative_sci_workflow.cvs_atrr_level_locking')) #attr level locking based collaboration... uncomment for this feature

	#if not row or list(row)[0].value != password:
	#	return redirect(url_for('p2irc'))
	#else:
	#	return redirect(url_for('cvs'))





#User Login Verification (MODULE LOCKING)
@app_collaborative_sci_workflow.route('/p2irc_login_moduleLocking/',  methods=['POST'])
def p2irc_login_moduleLocking():
	email = request.form['email']
	password = request.form['password']

	row = (views_by_email(g.couch))[email]


	p2irc_user = ''
	if not row :
		return redirect(url_for('app_collaborative_sci_workflow.p2irc_moduleLocking'))
	else:
		p2irc_user = P2IRC_User.load(list(row)[0].value)

	if p2irc_user.email != email or p2irc_user.password != password:
		return redirect(url_for('app_collaborative_sci_workflow.p2irc_moduleLocking'))
	else:
		#first_name = p2irc_user.first_name
		#last_name = p2irc_user.last_name
		#email = p2irc_user.email
		session['p2irc_user_email'] = email
		#return redirect(url_for('app_collaborative_sci_workflow.cvs')) #turn based collaboration... uncomment for this feature
		return redirect(url_for('app_collaborative_sci_workflow.cvs_module_locking')) #modular locking based collaboration... uncomment for this feature
		#return redirect(url_for('app_collaborative_sci_workflow.cvs_atrr_level_locking')) #attr level locking based collaboration... uncomment for this feature

	#if not row or list(row)[0].value != password:
	#	return redirect(url_for('p2irc'))
	#else:
	#	return redirect(url_for('cvs'))





#User Login Verification (FINE GRAINED, proposed)
@app_collaborative_sci_workflow.route('/p2irc_login_fineGrained/',  methods=['POST'])
def p2irc_login_fineGrained():
	email = request.form['email']
	password = request.form['password']

	row = (views_by_email(g.couch))[email]


	p2irc_user = ''
	if not row :
		return redirect(url_for('app_collaborative_sci_workflow.p2irc_fineGrained'))
	else:
		p2irc_user = P2IRC_User.load(list(row)[0].value)

	if p2irc_user.email != email or p2irc_user.password != password:
		return redirect(url_for('app_collaborative_sci_workflow.p2irc_fineGrained'))
	else:
		#first_name = p2irc_user.first_name
		#last_name = p2irc_user.last_name
		#email = p2irc_user.email
		session['p2irc_user_email'] = email
		#return redirect(url_for('app_collaborative_sci_workflow.cvs')) #turn based collaboration... uncomment for this feature
		#return redirect(url_for('app_collaborative_sci_workflow.cvs_module_locking')) #modular locking based collaboration... uncomment for this feature
		return redirect(url_for('app_collaborative_sci_workflow.cvs_atrr_level_locking')) #attr level locking based collaboration... uncomment for this feature

	#if not row or list(row)[0].value != password:
	#	return redirect(url_for('p2irc'))
	#else:
	#	return redirect(url_for('cvs'))





	
################## PIPELINE SAVING ENDS HERE ##############################
###########################################################################






@app_collaborative_sci_workflow.route('/ccv')
def ccv():
	#c =  CodeClones()
	#c.username = "A new User"
	#c.password = "A new Password"
	#c.store()

	#entry = CodeClones.load('d7dd92d4391d6ddbec202f75a60089f9')
	#entry.password = 'yay... password edited....'
	#entry.store()

	#sources = []
	#for row in views_by_user(g.couch):
	#	sources.append(row.value)
	#sources = list(sources)

    #document = views_by_user(g.couch)
 #   with open("code.java", "r") as f:
#	     content = f.read()
	#views_by_non_validated_clones

	sources = []
	for row in views_by_non_validated_clones(g.couch):
		sources.append(row.key)
	sources = list(sources)



	doc_length = len(sources)#checking if there is any further clone available or not to validate

	#No un-validated clone docs available
	if(doc_length == 0):
		#set some value representing end of clone validation docs.
		doc_id = 'NA'
		neural_net_response = 'NA'
		svm_response = 'NA'

		codeFragment_1 = 'No more clones available for validation.'
		codeFragment_2 = 'No more clones available for validation.'

	else:
		#p = str(CodeClones.load(sources[0]).fragment_2.path).strip('"')
		clone_doc = CodeClones.load(sources[0])
		doc_id = clone_doc.id

		"""
		fragment_1_code = ''
		with open(str(CodeClones.load(sources[0]).fragment_1.path).strip('"'), "r") as text_file:
			for line in itertools.islice(text_file, int(clone_doc.fragment_1.start_line), int(clone_doc.fragment_1.end_line)):
				#lines.append(line)
				fragment_1_code = fragment_1_code + line


		fragment_2_code = ''
		with open(p, "r") as text_file:
			for line in itertools.islice(text_file, int(clone_doc.fragment_2.start_line), int(clone_doc.fragment_2.end_line)):
				#lines.append(line)
				fragment_2_code = fragment_2_code + line
		""" 
		codeFragment_1 = getCodeFragment(clone_doc.fragment_1.path, clone_doc.fragment_1.start_line, clone_doc.fragment_1.end_line)
		codeFragment_2 = getCodeFragment(clone_doc.fragment_2.path, clone_doc.fragment_2.start_line, clone_doc.fragment_2.end_line)
	
		neural_net_response = ''
		svm_response = ''
		for response in clone_doc.auto_validation_result:
			if response['algorithm'] == 'Neural Network':
				neural_net_response = response['result'];
			if response['algorithm'] == 'SVM':
				svm_response = response['result'];


	return render_template('codeclone_validation.html', 
	codeFragment_1=codeFragment_1, 
	codeFragment_2=codeFragment_2,
	neural_net_response = neural_net_response,
	svm_response = svm_response,
	doc_id=doc_id)




@app_collaborative_sci_workflow.route('/get_next_code_fragments_for_validation',  methods=['POST'])
def get_next_code_fragments_for_validation():
	prev_doc_id = request.form['doc_id']
	user_response = request.form['user_response']

	clone_doc = CodeClones.load(prev_doc_id)
	clone_doc.is_validated_by_any_user = "yes"
	clone_doc.user_validation_result.append(user='golammostaeen', result=user_response)
	clone_doc.store()




	#cd = CodeClones.load('bf54d49f8654f0653c85a9cd2f011ab0')

	sources = []
	for row in views_by_non_validated_clones(g.couch):
		sources.append(row.key)
	sources = list(sources)

	doc_length = len(sources)#checking if there is any further clone available or not to validate

	#No un-validated clone docs available
	if(doc_length == 0):
		#set some value representing end of clone validation docs.
		doc_id = 'NA'
		neural_net_response = 'NA'
		svm_response = 'NA'

		codeFragment_1 = 'No more clones available for validation.'
		codeFragment_2 = 'No more clones available for validation.'
	
	else:
		cd = CodeClones.load(sources[0])


		doc_id = cd.id
		codeFragment_1 = getCodeFragment(cd.fragment_1.path, cd.fragment_1.start_line,cd.fragment_1.end_line)
		codeFragment_2 = getCodeFragment(cd.fragment_2.path, cd.fragment_2.start_line,cd.fragment_2.end_line)

		neural_net_response = ''
		svm_response = ''
		for response in clone_doc.auto_validation_result:
			if response['algorithm'] == 'Neural Network':
				neural_net_response = response['result'];
			if response['algorithm'] == 'SVM':
				svm_response = response['result'];
	

	



	return jsonify({ 'doc_id':doc_id,
	'codeFragment_1': codeFragment_1, 
	'codeFragment_2': codeFragment_2,
	'neural_net_response':neural_net_response,
	'svm_response': svm_response })








@app_collaborative_sci_workflow.route('/codeclone_stats')
def codeclone_stats():
    #return 'hello'
    return render_template('codeclone_stats.html')


########CODE CLONE VALIDATION ENDS










################################################################
################# TOOL INTIGRATION STARTS HERE #################
################################################################
from flask import  request
from werkzeug import secure_filename

#app.config['UPLOAD_FOLDER'] =

@app_collaborative_sci_workflow.route('/tool_integration')
def upload_file():
   return render_template('tool_integration.html')


@app_collaborative_sci_workflow.route('/tool_integration_add_tool_name/',  methods=['POST'])
def tool_integration_add_tool_name():
	#get the request details
	new_tool_name = request.form['tool_name']

	new_tool_location = 'pipeline_modules/' + new_tool_name

	success = False

	if not os.path.exists(new_tool_location):
		os.makedirs(new_tool_location)
		success = True

	#return as the current owner
	return jsonify({'success':success})


@app_collaborative_sci_workflow.route('/uploader', methods = ['GET', 'POST'])
def uploader():
	if request.method == 'POST':
		new_tool_name = request.values['tool_name_inp']
		new_tool_location =  new_tool_name
		success = False
		if not os.path.exists(new_tool_location):
			os.makedirs('app_collaborative_sci_workflow/pipeline_modules/'+new_tool_location)
			success = True

		if success == True:
			file_tool_doc = request.files['tool_doc']
			file_tool_doc.save(os.path.join('app_collaborative_sci_workflow/pipeline_modules/'+str(new_tool_location)+'/',secure_filename(new_tool_name+'_doc.txt')))

			file_tool_script = request.files['tool_script']
			file_tool_script.save(os.path.join('app_collaborative_sci_workflow/pipeline_modules/'+str(new_tool_location)+'/',secure_filename(new_tool_name+'_main.py')))

			file_tool_setting = request.files['tool_setting']
			file_tool_setting.save(os.path.join('app_collaborative_sci_workflow/pipeline_modules/'+str(new_tool_location)+'/',secure_filename(new_tool_name+'_settings.py')))

			file_tool_setting_ui = request.files['tool_setting_ui']
			file_tool_setting_ui.save(os.path.join('app_collaborative_sci_workflow/pipeline_modules/'+str(new_tool_location)+'/',secure_filename(new_tool_name+'_html.txt')))

			#file_tool_additional_file = request.files['tool_additional_file']
			#file_tool_additional_file.save(os.path.join('app_collaborative_sci_workflow/pipeline_modules/'+str(new_tool_location)+'/',secure_filename(file_tool_additional_file.filename)))

	return 'file uploaded successfully'





@app_collaborative_sci_workflow.route('/uploadajax', methods = ['GET', 'POST'])
def uploadajax():
	file = request.files['file']
	file.save(os.path.join('app_collaborative_sci_workflow/pipeline_modules/', secure_filename(file.filename)))
	return "Ajax file upload success"



################################################################
################# TOOL INTIGRATION ENDS HERE ###################
################################################################








###############################################################
######## OUTPUT VISUALIZATION and DOWNLODS STARTS #############
###############################################################

from flask import send_file

#output file downloads
@app_collaborative_sci_workflow.route('/file_download/', methods=['GET'])
def file_download():
	workflow_id = request.args.get('workflow_id') #unique workflow name
	file_id = request.args.get('file_id')
	filePath_to_download = '/home/ubuntu/Webpage/app_collaborative_sci_workflow/workflow_outputs/'+str(workflow_id)+'/'+str(file_id)#+ workflow_id + '/' + file_id
	try:
		return send_file(filePath_to_download, as_attachment=True)
	except Exception as e:
		return str(e)
	  

#list of workflow outputs
@app_collaborative_sci_workflow.route('/get_workflow_outputs_list/',  methods=['POST'])
def get_workflow_outputs_list():
	workflow_id = request.form['workflow_id'] #the unique workflow name 
	workflow_outputs_list = os.listdir("app_collaborative_sci_workflow/workflow_outputs/"+workflow_id)
	return jsonify({'workflow_outputs_list':workflow_outputs_list})










################################################################
######## COLLABORATIVE LOCKING MACHANISMS ######################
################ STARTS HERE ###################################
################ TURN BASED ####################################
################################################################


#Model for request management of turn based floor access.
class WorkflowLockingTurn(Document):
	the_doc_type = TextField(default='workflow_locking_turn')
	workflow_id = TextField()
	floor_flag = TextField(default='unoccupied')
	request_queue = ListField(TextField())
	current_floor_owner = TextField(default='NONE')


@app_collaborative_sci_workflow.route('/init_locking_server/',  methods=['GET'])
def init_locking_server():

	#Remove all existing documents
	for row in views_by_workflow_locking_turn(g.couch):
		tmp = WorkflowLockingTurn.load(row.value)
		g.couch.delete(tmp)

	#Add one doc
	turnBasedLocking = WorkflowLockingTurn(workflow_id='workflow_turn_id_1')
	turnBasedLocking.store()

	return jsonify({'success': 'OK'})






locking_turn_current_floor_owner = 'NONESRV'

@app_collaborative_sci_workflow.route('/locking_turn_request_floor/',  methods=['GET', 'POST'])
def locking_turn_request_floor():
	#get the request details
	workflow_id = 'workflow_turn_id_1'#request.form['workflow_id']
	floor_requestor = 'gm_gmail_com'#request.form['floor_requestor']

	haveIGotTheFloor = False


	#get the request key for the corresponding workflow id
	for row in views_by_workflow_locking_turn(g.couch):
		if row.key == workflow_id:
			workflow_locking_doc = WorkflowLockingTurn.load(row.value)

			if workflow_locking_doc.floor_flag == "unoccupied":
				workflow_locking_doc.floor_flag = "occupied"
				workflow_locking_doc.current_floor_owner = floor_requestor
				workflow_locking_doc.store() #store the updated doc
				#return variable state
				haveIGotTheFloor = True
			elif workflow_locking_doc.floor_flag == "occupied":
				#queue the request and update db
				workflow_locking_doc.request_queue.append(floor_requestor)
				workflow_locking_doc.store()#storing first for ensuring consistency
				#return variable state
				haveIGotTheFloor = False
			break

	#return as the status of the requested user.
	return jsonify({'haveIGotTheFloor':haveIGotTheFloor})


@app_collaborative_sci_workflow.route('/locking_turn_release_floor/',  methods=['POST'])
def locking_turn_release_floor():
	#get the request details
	workflow_id = request.form['workflow_id']
	#floor_releaser = request.form['floor_releaser']


	#get the request key for the corresponding workflow id
	for row in views_by_workflow_locking_turn(g.couch):
		if row.key == workflow_id:
			workflow_locking_doc = WorkflowLockingTurn.load(row.value)

			if len(workflow_locking_doc.request_queue)>= 1:
				#new floor owner
				locking_turn_current_floor_owner = workflow_locking_doc.request_queue[0]
				workflow_locking_doc.current_floor_owner = locking_turn_current_floor_owner
				#pop the new owner from the request Q
				workflow_locking_doc.request_queue.pop(0)
				workflow_locking_doc.store()
			else: #no one waiting in the Q
				locking_turn_current_floor_owner = 'NONE'
				workflow_locking_doc.floor_flag = 'unoccupied'
				workflow_locking_doc.store()
			break


	#return as the status of the requested user.
	return jsonify({'newFloorOwner':locking_turn_current_floor_owner})








@app_collaborative_sci_workflow.route('/locking_turn_get_request_queue/',  methods=['POST'])
def locking_turn_get_request_queue():
	#get the request details
	workflow_id = request.form['workflow_id']

	request_queue = []

	#get the request key for the corresponding workflow id
	for row in views_by_workflow_locking_turn(g.couch):
		if row.key == workflow_id:
			workflow_locking_doc = WorkflowLockingTurn.load(row.value)
			request_queue = workflow_locking_doc.request_queue
			break


	#return as the current owner
	return jsonify({'floor_requests_queue':request_queue})



@app_collaborative_sci_workflow.route('/locking_turn_get_current_floor_owner/',  methods=['POST'])
def locking_turn_get_current_floor_owner():
	#get the request details
	#workflow_id = request.form['workflow_id']
	#get the request details
	workflow_id = 'workflow_turn_id_1'

	cOwner = ''

	#get the request key for the corresponding workflow id
	for row in views_by_workflow_locking_turn(g.couch):
		if row.key == workflow_id:
			workflow_locking_doc = WorkflowLockingTurn.load(row.value)
			cOwner = workflow_locking_doc.current_floor_owner
			break


	#return as the current owner
	return jsonify({'current_floor_owner_srv':cOwner})




################################################################
################ TURN BASED ####################################
######## COLLABORATIVE LOCKING MACHANISMS ######################
################ ENDS HERE #####################################
################################################################
import subprocess
from subprocess import *
from io import StringIO
import sys

@app_collaborative_sci_workflow.route('/run_bash/',  methods=['GET'])
def run_bash():
	input_source = '/home/ubuntu/Webpage/app_collaborative_sci_workflow/workflow_outputs/test_workflow/detectedClones.xml'
	output_destination = '/home/ubuntu/Webpage/app_collaborative_sci_workflow/workflow_outputs/test_workflow/cloneClass'

	pipe = subprocess.Popen(
		["/bin/bash",
		 "/home/ubuntu/Webpage/app_collaborative_sci_workflow/External_Libraries/NiCad-4.0/scripts/ClusterPairs",
		 input_source,
		 output_destination]).communicate()


	return "SUCCESS 200"





